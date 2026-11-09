#!/usr/bin/env python3
"""Refresh Scout from public employer ATS feeds; Python stdlib only.

No scraping of student-only pages, no credentials, no application automation.
A scheduled action updates listings.json, listings.js and latest_digest.json.
"""
from __future__ import annotations

import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
NOW = datetime.now(timezone.utc)
STAMP = NOW.isoformat(timespec='seconds').replace('+00:00', 'Z')
TODAY = NOW.date().isoformat()

INTERNSHIP = re.compile(r'\b(intern(ship|ships)?|summer analyst|summer associate|co[ -]?op|undergraduate associate)\b', re.I)
EXCLUDE = re.compile(r'\b(MBA|Ph\.?D\.?|postdoc|graduate internship|master.s student)\b', re.I)
# Avoid tagging technical internships as Finance just because they are at a fintech.
NON_FINANCE_TITLE = re.compile(r'\b(software engineer(?:ing)?|frontend|backend|iOS engineer|android engineer|applied scientist|machine learning|devops|site reliability|graphic design|UX design|product designer|data engineer|hardware engineer|civil engineer|electrical engineer|mechanical engineer|construction engineering|biology|biochemistry|laboratory|nursing|pharmacy|engineering sciences|product management|cybersecurity)\b', re.I)
ATL = re.compile(r'atlanta|alpharetta|sandy springs|brookhaven|marietta|buckhead|dunwoody|roswell|decatur|smyrna|norcross|duluth|johns creek|kennesaw|peachtree|chamblee|conyers|college park|suwanee|vinings|norcross|lawrenceville|tyrone|woodstock|acworth|cumming', re.I)
ATH = re.compile(r'athens|watkinsville|bogart|oconee|statham|winterville', re.I)
REMOTE = re.compile(r'\bremote\b|work from anywhere', re.I)
FIELD_MATCHERS = [
    ('Tax', re.compile(r'\btax\b|taxation|transfer pricing', re.I)),
    ('Audit', re.compile(r'audit|assurance|attest|internal audit|SOX|forensic accounting', re.I)),
    ('Risk', re.compile(r'risk advisory|risk management|risk intern|compliance|regulatory|financial crime|quant strats', re.I)),
    ('Banking', re.compile(r'commercial bank|corporate bank|investment bank|credit analys|loan operations|loan underwriting|underwrit|lending|brokerage|sales and trading|capital markets|origination', re.I)),
    ('Wealth', re.compile(r'wealth|private bank|private client|financial advisor|financial planning|family office|\bRIA\b|client advisor', re.I)),
    ('Investment', re.compile(r'investment|asset management|equity research|hedge fund|portfolio|private equity|valuation|damages|investor relation|fund accounting|real estate debt|equity long.short', re.I)),
    ('Accounting', re.compile(r'accounting|bookkeeping|controller|controllership|financial reporting|accounts payable|accounts receivable|\bCPA\b', re.I)),
    ('Finance', re.compile(r'financ|treasury|pricing|FP&A|financial analys|budgeting|private credit|financial assets', re.I)),
    ('Consulting', re.compile(r'consult|advisory|transaction services|due diligence', re.I)),
    ('Analytics', re.compile(r'analytics|data analys|business intelligence|business analys|financial data', re.I)),
    ('Strategy', re.compile(r'corporate strategy|business strategy', re.I)),
    ('Operations', re.compile(r'business operations|finance operations|fund operations', re.I)),
]
# Regional priority is Atlanta / Athens, with a national US expansion.
# Exclude clearly international locations rather than treating them as "Nationwide".
NON_US_ONLY = re.compile(
    r'\b(India|Singapore|Australia|New Zealand|Germany|France|Spain|Netherlands|'
    r'United Kingdom|UK\b|England|Scotland|Ireland|China|Japan|Hong Kong|'
    r'Pakistan|Philippines|Mexico|Brazil|Poland|Romania|Turkey|South Africa)\b', re.I)
US_INDICATOR = re.compile(
    r'\b(US|USA|U\.S\.|United States|America|'
    r'Atlanta|Athens|New York|NYC|Chicago|Boston|Miami|Dallas|Denver|'
    r'San Francisco|San Jose|Los Angeles|Torrance|Seattle|Portland|'
    r'Houston|Austin|Washington|Philadelphia|Baltimore|Phoenix|'
    r'Charlotte|Nashville|Indianapolis|Minneapolis|Orlando|Tampa|'
    r'California|Colorado|Georgia|Texas|Florida|Illinois|'
    r'Connecticut|Massachusetts|Virginia|Maryland|Minnesota|'
    r'North Carolina|South Carolina|New Jersey|Pennsylvania|'
    r'Arizona|Ohio|Oregon|Wisconsin|Michigan|Utah|Tennessee|'
    r'Nevada|Missouri|Kentucky|Alabama|Kansas|Nebraska|'
    r'WA|CA|GA|FL|NY|TX|IL|CO|MA|DC|NC|SC|NJ|PA|MN|CT|AZ)\b', re.I)

def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return default


def request_json(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': 'ScoutUGA-Internship-Tracker/1.0 (public job board reader)', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as response:
        if response.status != 200:
            raise ValueError(f'HTTP {response.status}')
        return json.loads(response.read(12_000_000).decode('utf-8'))


def clean_text(value: str | None):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(str(value or '')))).strip()


def secure_url(u):
    try:
        parts = urllib.parse.urlparse(str(u))
        if parts.scheme == 'https' and parts.netloc:
            return str(u)
    except Exception:
        pass
    return None


def normalize(text):
    return re.sub(r'[^a-z0-9]+', '', str(text).casefold())


def classify_category(title, text, department=''):
    # Prioritize the *role's* name/department, never the employer's general description.
    title_low = title.lower()
    if 'mercer advisors' in title_low:
        return 'Wealth'
    for label, matcher in FIELD_MATCHERS:
        if matcher.search(title):
            return label
    for label, matcher in FIELD_MATCHERS:
        if department and matcher.search(department):
            return label
    # Catch broad titles like "HFA Internship 2027" only if the body has explicit,
    # job-specific context. Avoid false positives from generic employer introductions.
    if re.search(r'\b(?:intern(?:ship)?|co[ -]?op|summer analyst)\b', title, re.I):
        for label in ('Accounting','Tax','Audit','Finance','Investment','Banking','Wealth','Risk','Analytics'):
            matcher = next(m for name,m in FIELD_MATCHERS if name == label)
            if matcher.search(text[:650]):
                return label
    return None


def graduation_years(title, body):
    years = set()
    text = title + ' ' + body
    for m in re.finditer(r'\b20(?:27|28|29|30|31)\b', text):
        ctx = text[max(0, m.start()-75):min(len(text), m.end()+75)]
        if re.search(r'graduat|class of|degree complet|degree conferr', ctx, re.I):
            years.add(int(m.group(0)))
    return sorted(years)


def classify_eligibility(title: str, body: str):
    text = f'{title} {body}'
    if re.search(r'\b(?:no|exclude(?:s|d)?|ineligible for|not (?:open|eligible|available) (?:to|for))\s+(?:sophomores?|rising juniors?)\b', text, re.I):
        return 'unknown', 'Listing may exclude sophomores; check the exact qualifications'
    if re.search(r'\b(sophomores?|second.year students?|rising juniors?)\b', text, re.I):
        return 'confirmed', 'Listing mentions sophomores or rising juniors; confirm full requirements'
    # Only assign confirmed if a graduation requirement mentions May 2029.
    for m in re.finditer(r'\b2029\b', text):
        window = text[max(0,m.start()-85):min(len(text),m.end()+85)]
        if re.search(r'graduat|class of|degree completion', window, re.I):
            return 'confirmed', 'Employer text mentions 2029 graduation; verify exact allowed graduation window'
    if re.search(r'\b(2027|2028)\b', text, re.I):
        # Never infer exclusion from a program year alone.
        year_req = re.search(r'(graduat\w*|class of|degree completion)\W{0,75}\b(2027|2028)\b', text, re.I)
        if year_req:
            return 'unknown', 'Graduation language may exclude May 2029; check official qualifications'
    return 'unknown', 'Class-year eligibility is not explicitly established; verify before applying'


def find_season(title, text):
    sample = f'{title} {text[:180]}'
    m = re.search(r'\b(summer|spring|fall|winter)\s*(20(?:26|27|28|29|30))\b', sample, re.I)
    if m: return f'{m.group(1).title()} {m.group(2)}'
    m = re.search(r'\b(20(?:27|28|29|30))\s+(summer|spring|fall|winter)\b', sample, re.I)
    if m: return f'{m.group(2).title()} {m.group(1)}'
    return 'Not specified'


def parse_posted(value):
    if isinstance(value, (int, float)):
        try: return datetime.fromtimestamp(value / 1000 if value > 9e11 else value, timezone.utc).date().isoformat()
        except (ValueError, OverflowError): pass
    if isinstance(value, str):
        m = re.match(r'\d{4}-\d{2}-\d{2}', value)
        return m.group(0) if m else None
    return None


def classify_area(location, remote):
    if ATH.search(location): return 'Athens'
    if ATL.search(location): return 'Atlanta'
    if remote or REMOTE.search(location): return 'Remote'
    return 'Nationwide'


def field_entry(company, board, key, title, location, body, url, posted, remote=False, salary=None, department=''):
    if not INTERNSHIP.search(title) or EXCLUDE.search(title): return None
    if not secure_url(url) or not key: return None
    if len(title) > 180 or len(company) > 140: return None
    if NON_FINANCE_TITLE.search(title): return None
    if re.search(r'\b(pipeline|talent pool|future internship opportunities|open application)\b', title, re.I): return None
    # Never add obvious non-US positions to the US board. A global/multi-office
    # location can include other countries when at least one US location is present.
    if NON_US_ONLY.search(location) and not US_INDICATOR.search(location) and not REMOTE.search(location):
        return None
    area = classify_area(location, remote)
    category = classify_category(title, body, department)
    if not category: return None
    season = find_season(title, body)
    eligibility, eligibility_note = classify_eligibility(title, body)
    return {
        'id': f'feed-{board}-{key}', 'company': company, 'title': title,
        'location': location or ('Remote' if remote else 'Location unspecified'),
        'area': area, 'category': category, 'season': season,
        'eligibility': eligibility, 'eligibility_note': eligibility_note,
        'graduation_years': graduation_years(title, body),
        'salary': salary, 'url': url, 'source': f'{company} employer feed',
        'source_board': board, 'status': 'live-feed', 'first_seen': TODAY,
        'posted_at': parse_posted(posted), 'deadline': None
    }


def fetch_greenhouse(src):
    board = urllib.parse.quote(src['board'], safe='')
    content = request_json(f'https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true')
    for j in content.get('jobs', []):
        location = (j.get('location') or {}).get('name') or ''
        yield field_entry(src['company'], board, j.get('id'), j.get('title') or '', location, clean_text(j.get('content')), j.get('absolute_url'), j.get('updated_at'), department=' / '.join(d.get('name', '') for d in j.get('departments', []) if isinstance(d, dict)))


def fetch_lever(src):
    board = urllib.parse.quote(src['board'], safe='')
    posts = request_json(f'https://api.lever.co/v0/postings/{board}?mode=json')
    if not isinstance(posts, list): raise ValueError('Unrecognized Lever data')
    for j in posts:
        loc = (j.get('categories') or {}).get('location') or ''
        body = (j.get('descriptionPlain') or '') + ' ' + (j.get('additionalPlain') or '')
        yield field_entry(src['company'], board, j.get('id'), j.get('text') or '', loc, body, j.get('hostedUrl'), j.get('createdAt'), department=' / '.join(str(v) for v in ((j.get('categories') or {}).get('department'),(j.get('categories') or {}).get('team')) if v))


def fetch_ashby(src):
    board = urllib.parse.quote(src['board'], safe='')
    data = request_json(f'https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true')
    for j in data.get('jobs', []):
        compensation = j.get('compensation') or {}
        pay = compensation.get('compensationTierSummary') if isinstance(compensation, dict) else None
        yield field_entry(src['company'], board, j.get('id') or normalize(j.get('title')), j.get('title') or '', j.get('location') or '', j.get('descriptionPlain') or clean_text(j.get('descriptionHtml')), j.get('jobUrl') or j.get('applyUrl'), j.get('publishedAt'), bool(j.get('isRemote')), pay, department=str(j.get('department') or ''))

FETCHERS = {'greenhouse': fetch_greenhouse, 'lever': fetch_lever, 'ashby': fetch_ashby}

def main():
    sources = read_json(DATA/'sources.json', [])
    old = read_json(DATA/'listings.json', {'jobs':[]})
    old_jobs = old.get('jobs', [])
    previous_by_id = {j['id']: j for j in old_jobs if j.get('id')}
    existing = list(old_jobs)
    seen_ids = set()
    succeeded = set()
    errors = []
    fresh = []
    for src in sources:
        typ, slug = src.get('type'), src.get('board')
        if typ not in FETCHERS or not re.fullmatch(r'[a-zA-Z0-9_-]+', str(slug)):
            errors.append(f'Invalid source configuration: {src.get("company", "unknown")}');continue
        try:
            results = list(FETCHERS[typ](src))
            succeeded.add(slug)
            for job in results:
                if not job: continue
                seen_ids.add(job['id'])
                previous = previous_by_id.get(job['id'])
                if previous:
                    job['first_seen'] = previous.get('first_seen') or TODAY
                    if previous.get('eligibility') == 'confirmed' and job.get('eligibility') == 'unknown':
                        # Prior manual review is not automatically transferable to changed descriptions.
                        pass
                    existing = [j for j in existing if j.get('id') != job['id']]
                else:
                    # Prefer a verified employer-feed listing over duplicate seed job-board leads.
                    same = next((j for j in existing if j.get('status') == 'lead' and normalize(j.get('company')) == normalize(job['company']) and normalize(j.get('title')) == normalize(job['title'])), None)
                    if same:
                        job['first_seen'] = same.get('first_seen') or TODAY
                        existing.remove(same)
                    else:
                        fresh.append(job['id'])
                existing.append(job)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            errors.append(f'{src.get("company",slug)}: {type(exc).__name__} — {str(exc)[:120]}')
    if not succeeded:
        print('No feeds could be checked; preserving last known snapshot.', file=sys.stderr)
        for err in errors: print(err, file=sys.stderr)
        return 1
    for job in existing:
        if job.get('status') == 'live-feed' and job.get('source_board') in succeeded and job.get('id') not in seen_ids:
            job['status'] = 'not-seen'
            job['eligibility_note'] = 'Not present on the latest successful employer feed; may have closed. Recheck before applying.'
    # Avoid removing user-facing snapshots just because a board failed.
    existing = [j for j in existing if not (j.get('status') == 'live-feed' and NON_FINANCE_TITLE.search(j.get('title','')))]
    existing = sorted(existing, key=lambda j: (j.get('status') != 'live-feed', j.get('area') not in {'Atlanta','Athens'}, j.get('company','').casefold(), j.get('title','').casefold()))[:600]
    output = {
        'updated_at': STAMP, 'update_type': 'automated_feed_scan',
        'source_note': 'ATS feeds checked. A job appears active only when an employer feed returned it; other listings remain unverified leads. Handshake requires a UGA login and is not scraped.',
        'successful_sources': len(succeeded), 'configured_sources': len(sources),
        'jobs': existing,
    }
    digest = {'updated_at': STAMP, 'added_ids': fresh, 'errors': errors,
              'message': f'Daily scan completed: {len(succeeded)} employer boards checked, {len(fresh)} newly discovered internships.'}
    (DATA/'listings.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    (DATA/'listings.js').write_text('window.SCOUT_DATA = '+json.dumps(output, ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    (DATA/'latest_digest.json').write_text(json.dumps(digest, ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Updated with {len(existing)} jobs from {len(succeeded)}/{len(sources)} feeds; {len(fresh)} new; {len(errors)} feed errors.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
