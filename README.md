# Scout — UGA & Atlanta Internship Tracker

**A free, mobile-friendly web app** for UGA students graduating in May 2029. Search and save internships, mark application stages, write notes, export your tracker, and review weekly new openings. The initial data is a curated set of internship **leads**, *not* a guarantee each role is still open or class-year eligible.

## Run it in under a minute (Mac or Windows)

1. Unzip the project.
2. Double-click `index.html`. The app works locally with the bundled launch snapshot. You can immediately save jobs, add Handshake postings, track applications, and export CSV.
3. Your personal notes, bookmarks, and statuses are saved **only in this browser on this device** (subject to browser support for local `file://` storage). For reliable persistence, use the hosted site or `localhost` and export CSV backups regularly. Private browsing, clearing site data, or switching devices can erase them.

You don't need Node, paid APIs, or a backend to browse the launch snapshot.

## Host free and enable automatic weekly updates

GitHub Pages is free for public repositories and requires no server. If you prefer not to publish this app on a public repository, use a hosting option compatible with your GitHub account's plan.

1. Create a **new repository** on GitHub (e.g., `uga-internship-scout`). **Do not upload into another existing project.** Make it public if needed for free GitHub Pages.
2. Upload **all project files** (including the `.github/workflows` hidden directory) to the repository root. GitHub's browser upload may skip hidden files if selecting folders; use GitHub Desktop, Git command-line, or explicitly upload `.github/workflows/weekly-internships.yml`.
3. Go to **Settings → Pages**; set **Deploy from a branch**, `main`, `/ (root)`. Save. Your site will appear at `https://YOUR_USERNAME.github.io/uga-internship-scout/` (replace values with your username and exact repo name).
4. Go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, then save if this option is available. Org policies may restrict it. The workflow also declares `contents: write`.
5. Go to **Actions → Scout Weekly Internship Scan → Run workflow** for a first test. Verify a successful run, check the new digest, and reload the website. Scheduled runs follow at **14:00 UTC every Monday** (9am Eastern standard time; 10am during daylight time). GitHub scheduled workflows may be delayed.
6. Optional: On your phone, open the published site in Safari, choose **Share → Add to Home Screen** to install an app-style shortcut.

The scanner uses public Greenhouse, Lever and Ashby employer posting APIs only. It **does not** scrape behind logins, bypass authentication, collect private Handshake data, or automatically apply for you. Individual boards may not exist or may reject requests; those errors appear in `data/latest_digest.json`. A failed complete scan does not overwrite the last verified dataset. The scanner is intentionally focused on employers currently configured; it will **not find every internship in Atlanta**.

## Configure employer feeds

Edit `data/sources.json`. Example:

```json
{"company":"Point72","type":"greenhouse","board":"point72","location_scope":"Nationwide"}
```

Each entry needs a public employer ATS board slug and `type` (`greenhouse`, `lever` or `ashby`). Some starting board slugs are candidate leads and may be stale or unavailable; failures are logged, not invented. To find new boards, locate the employer's official careers page and check whether it is hosted by one of those three ATS vendors. Some companies use Workday or other platforms and will need manual listing entry or another properly authorized public feed.

`data/listings.json` powers the app; `data/listings.js` lets the app also work by double-clicking `index.html` offline. Both are updated by the same script. `data/latest_digest.json` records newly seen items and failed feeds.

## What the app can and cannot confirm

- **Confirmed 2029 fit:** the employer text explicitly mentions a sophomore/rising junior or a 2029 graduation requirement. Always verify precise dates and degree restrictions.
- **Possible 2029 fit:** a previously reviewed listing may accept undergraduates without explicitly excluding May 2029; check the actual description again.
- **Check class-year fit:** insufficient information; **never** assume you're eligible.
- **Employer feed:** role was returned by a successful official ATS board scan. This indicates it appeared in that feed at scan time, **not** that the employer will still accept applications when you click it.
- **Initial lead:** discovered on a job board at launch, not necessarily live or eligible today.
- **New to Scout:** first detected by the tracker within seven days; **not necessarily newly posted by the employer**.

UGA Handshake access is student-authenticated; use the app's **Add opportunity** feature to save those jobs manually. ChatGPT's separate Monday internship reminder is not directly connected to the site's data, and the site cannot send push/email alerts by itself. It is designed as the browser dashboard to complement that weekly update.

## Run the scan on your computer

```bash
cd uga-internship-scout
python3 scripts/update_jobs.py
python3 -m http.server 8000
```

Open `http://localhost:8000`. The script needs internet access; if all configured employer endpoints fail, it exits with status 1 without overwriting prior listings. There are **no Python package dependencies**.

## Privacy, safety, and cost

- No account signup; no service API keys in code.
- No application automation or sharing of resumes.
- Notes and statuses use browser local storage; **not synced across devices**.
- Static hosting and scheduled workflow can be operated at **$0** within your GitHub account's included limits.
- Verify employer posting URLs, eligibility, pay, and deadlines before making decisions. Some aggregator redirects and salaries may be stale or estimated.
