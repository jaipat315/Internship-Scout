# Scout — UGA & Atlanta Internship Tracker

**A free, mobile-friendly web app** for UGA students across class years, focused on finance and accounting internships in Athens and metro Atlanta. Search and save internships, mark application stages, write notes, export your tracker, and review daily new openings. The initial data is a curated set of internship **leads**, *not* a guarantee each role is still open or class-year eligible.

## Run it in under a minute (Mac or Windows)

1. Unzip the project.
2. Double-click `index.html`. The app works locally with the bundled launch snapshot. You can immediately save jobs, add Handshake postings, track applications, and export CSV.
3. Your personal notes, bookmarks, and statuses are saved **only in this browser on this device** (subject to browser support for local `file://` storage). For reliable persistence, use the hosted site or `localhost` and export CSV backups regularly. Private browsing, clearing site data, or switching devices can erase them.

You don't need Node, paid APIs, or a backend to browse the launch snapshot.

## Host free and enable automatic daily updates

GitHub Pages is free for public repositories and requires no server. If you prefer not to publish this app on a public repository, use a hosting option compatible with your GitHub account's plan.

1. Create a **new repository** on GitHub (e.g., `uga-internship-scout`). **Do not upload into another existing project.** Make it public if needed for free GitHub Pages.
2. Upload **all project files** (including the `.github/workflows` hidden directory) to the repository root. GitHub's browser upload may skip hidden files if selecting folders; use GitHub Desktop, Git command-line, or explicitly upload `.github/workflows/weekly-internships.yml`.
3. Go to **Settings → Pages**; set **Deploy from a branch**, `main`, `/ (root)`. Save. Your site will appear at `https://YOUR_USERNAME.github.io/uga-internship-scout/` (replace values with your username and exact repo name).
4. Go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, then save if this option is available. Org policies may restrict it. The workflow also declares `contents: write`.
5. Go to **Actions → Scout Weekly Internship Scan → Run workflow** for a first test. Verify a successful run, check the new digest, and reload the website. Scheduled runs follow every day at **8:17 AM America/New_York** (DST-aware). GitHub scheduled workflows may be delayed.
6. Optional: On your phone, open the published site in Safari, choose **Share → Add to Home Screen** to install an app-style shortcut.

The scanner uses public Greenhouse, Lever and Ashby employer posting APIs only. It includes configured public accounting feeds (Moore Colson, Aprio), corporate finance, banking, wealth and risk feeds, and excludes software engineering roles unrelated to the target fields. It **does not** scrape behind logins, bypass authentication, collect private Handshake data, or automatically apply for you. Individual boards may not exist or may reject requests; those errors appear in `data/latest_digest.json`. A failed complete scan does not overwrite the last verified dataset. The scanner is intentionally focused on configured public employer feeds; it will **not find every finance or accounting internship**. Many Big Four and local firm career sites use systems not yet integrated.

## Configure employer feeds

Edit `data/sources.json`. Example:

```json
{"company":"Point72","type":"greenhouse","board":"point72","location_scope":"Nationwide"}
```

Each entry needs a public employer ATS board slug and `type` (`greenhouse`, `lever` or `ashby`). Some starting board slugs are candidate leads and may be stale or unavailable; failures are logged, not invented. To find new boards, locate the employer's official careers page and check whether it is hosted by one of those three ATS vendors. Some companies use Workday or other platforms and will need manual listing entry or another properly authorized public feed.

`data/listings.json` powers the app; `data/listings.js` lets the app also work by double-clicking `index.html` offline. Both are updated by the same script. `data/latest_digest.json` records newly seen items and failed feeds.

## What the app can and cannot confirm

- **Class-year evidence found:** employer text mentions a class level or graduation year; that does not guarantee the student meets all qualifications. Always verify precise dates and degree restrictions.
- **Possible match:** an earlier lead could fit, but its graduation requirements need verification.
- **Eligibility not stated:** insufficient details to confirm which class years qualify. The graduation-year filter keeps these unknown roles visible, marked for review.
- **Employer feed:** role was returned by a successful official ATS board scan. This indicates it appeared in that feed at scan time, **not** that the employer will still accept applications when you click it.
- **Initial lead:** discovered on a job board at launch, not necessarily live or eligible today.
- **New to Scout:** first detected by the tracker within seven days; **not necessarily newly posted by the employer**.

Share the public site with classmates. Bookmarks, notes and applications remain private to each person's own browser (not synced between users or devices). Graduation-year filtering only excludes postings with an explicitly different detected graduation year; all unknown-year roles remain visible for individual verification. UGA Handshake access is student-authenticated; use the app's **Add opportunity** feature to save those jobs manually. ChatGPT's separate internship reminder is not directly connected to the site's data, and the site cannot send push/email alerts by itself. It is designed as the browser dashboard to complement that weekly update.

## Run the scan on your computer

```bash
cd uga-internship-scout
python3 scripts/update_jobs.py
python3 -m http.server 8000
```

Open `http://localhost:8000`. The script needs internet access; if all configured employer endpoints fail, it exits with status 1 without overwriting prior listings. There are **no Python package dependencies**.

## Private progress sync for classmates (optional setup)

The public site and its daily scans work without any backend. By default, bookmarks, application stages, notes and hand-added listings remain in localStorage on that browser. **This survives normal revisits but not switching devices, deleting browser data, or private browsing.**

To enable real cross-device, per-student persistence, set up Supabase Auth and a private database:

1. Create a Supabase project (or connect Supabase in ChatGPT so it can be configured for you).
2. In Supabase SQL Editor, execute `supabase/scout-progress.sql`. It creates a per-user JSONB table with strict Row Level Security: each signed-in user can read/write **only their own** row.
3. In Supabase Dashboard → Project Settings/API, copy the **Project URL** and the **publishable (anon) key**. Edit `assets/cloud-config.js` with those two PUBLIC values. **Never paste a service_role/secret key into GitHub or the browser.**
4. In Authentication → URL Configuration, set the Site URL to `https://jaipat315.github.io/Internship-Scout/` and add that exact URL to your allowed redirect URLs. Enable email OTP/magic-link sign-in in Authentication → Providers → Email. Confirm your email templates and any email quota limits.
5. Commit the updated `assets/cloud-config.js` to GitHub. The **Save progress** button will allow email magic-link sign-in. On login, browser progress merges with the private account row and is saved to Supabase. Bookmarks/notes/application stages/manual listings then load when signing in from another device.

The login automatically merges existing browser records into the account. Change tracking uses per-entry modification timestamps to preserve saves/deletions across devices in normal serial use, but simultaneous edits on different devices are not guaranteed conflict-free. When signed out, account progress is cleared from that browser; cloud data remains under the user's account. For backups, export CSV.

A public key is safe to ship **only after Row Level Security is enabled and tested**. Do not store sensitive personal data beyond application notes. Each user's account is separate; a public link does not share another student's private notes.

## Privacy, safety, and cost

- Account login is optional, only after you configure Supabase. No private/service keys in code.
- No application automation or sharing of resumes.
- Notes and statuses use local browser storage by default. Once cloud sync is configured and a user signs in, their progress is privately synced across devices.
- Static hosting and scheduled workflow can be operated at **$0** within your GitHub account's included limits.
- Verify employer posting URLs, eligibility, pay, and deadlines before making decisions. Some aggregator redirects and salaries may be stale or estimated.

## Classmate-friendly scope

- **Finance:** corporate finance, FP&A, treasury, financial analysis and pricing.
- **Accounting:** financial reporting, controllership, bookkeeping, tax and assurance/audit.
- **Banking and investments:** credit/underwriting, wealth management, private banking, asset management and investments.
- **Adjacent business:** financial risk, compliance, consulting, analytics and business operations.
- **Graduation-year selector:** classes of 2027–2031. A blank employer requirement never establishes eligibility; such roles stay visible but flagged for checking.

The job listings dashboard is public. With Supabase properly configured, personal notes and statuses are saved privately per authenticated person. Without setup, each person's browser keeps their data locally.
