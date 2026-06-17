# Cloudflare Deployment Guide

This guide describes the minimal deployment path for confirming that the rating platform works on Cloudflare Pages with Pages Functions and D1.

Use the project directory as the deployment root:

```sh
cd /Users/tohokusla/Dropbox/Accentedness/Experiment/Rating_Platform
```

The expected Cloudflare structure is:

```text
Rating_Platform/
  index.html
  app.js
  styles.css
  admin/
  functions/
  db/schema.sql
  wrangler.toml
```

Do not deploy from `/Users/tohokusla/Dropbox/Accentedness` or `/Users/tohokusla/Dropbox/Accentedness/Experiment`. The `functions/` directory must be at the Pages project root.

## 1. Install and Log In to Wrangler

Use Wrangler through `npx` so a project-local install is not required:

```sh
npx wrangler login
npx wrangler whoami
```

If `whoami` shows your Cloudflare account, the CLI is ready.

## 2. Create a Cloudflare Pages Project

For the first feasibility test, use Direct Upload from Wrangler:

```sh
npx wrangler pages project create accentedness-rating-platform --production-branch main
```

This creates a Pages project named `accentedness-rating-platform`.

Relevant Cloudflare docs:

- [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)

## 3. Create a D1 Database

If EU data location is desired for the feasibility test, create the database with the EU jurisdiction option:

```sh
npx wrangler d1 create accentedness-rating --jurisdiction=eu
```

If a specific jurisdiction is not needed for the first test, use:

```sh
npx wrangler d1 create accentedness-rating
```

Wrangler returns a D1 database UUID. Copy that value for the next step.

Relevant Cloudflare docs:

- [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/)

Cloudflare notes that D1 jurisdictions can only be set when the database is created. If the wrong jurisdiction is selected, create a new D1 database rather than trying to update the existing one.

## 4. Create `wrangler.toml`

Copy the example file:

```sh
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml` and replace:

```toml
database_id = "replace-with-cloudflare-d1-database-id"
```

with the UUID returned by `wrangler d1 create`.

The binding name must remain:

```toml
binding = "DB"
```

The Pages Functions in this project expect `context.env.DB`.

Relevant Cloudflare docs:

- [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Wrangler configuration for Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

## 5. Apply the D1 Schema

Create the tables in the remote D1 database:

```sh
npx wrangler d1 execute accentedness-rating --remote --file=./db/schema.sql
```

This creates tables for sessions, assignments, trial responses, and event logs.

If you already created the D1 database before the counterbalance tables/columns were added, run the one-time migration instead:

```sh
npx wrangler d1 execute accentedness-rating --remote --file=./db/migrations/0002_counterbalance.sql
```

## 6. Set the Admin Secret

Generate a token:

```sh
openssl rand -base64 32
```

Set it as a Cloudflare Pages secret:

```sh
npx wrangler pages secret put ADMIN_TOKEN --project-name accentedness-rating-platform
```

Paste the generated token when prompted. Save the token securely; it is required for `/admin/`.

Do not put `ADMIN_TOKEN` in `wrangler.toml`.

## 7. Deploy

Deploy the current directory:

```sh
npx wrangler pages deploy . --project-name accentedness-rating-platform --branch main
```

Wrangler will print the deployed URL, usually in this form:

```text
https://accentedness-rating-platform.pages.dev/
```

## 8. Smoke Test

Open the participant page:

```text
https://accentedness-rating-platform.pages.dev/
```

Open the researcher admin page:

```text
https://accentedness-rating-platform.pages.dev/admin/
```

Enter the `ADMIN_TOKEN` on the admin page and confirm that summary counts load.

Then complete a short test session from the participant page. Do not add `?local=1` for this test, because `?local=1` bypasses server persistence.

After saving a few trials, confirm records exist in D1:

```sh
npx wrangler d1 execute accentedness-rating --remote --command "SELECT COUNT(*) AS sessions FROM sessions;"
npx wrangler d1 execute accentedness-rating --remote --command "SELECT COUNT(*) AS trials FROM rating_trials;"
npx wrangler d1 execute accentedness-rating --remote --command "SELECT COUNT(*) AS events FROM event_logs;"
npx wrangler d1 execute accentedness-rating --remote --command "SELECT cell_id, status, COUNT(*) AS n FROM counterbalance_allocations GROUP BY cell_id, status;"
```

On `/admin/`, confirm that these CSV downloads work:

- `sessions.csv`
- `ratings.csv`
- `assignments.csv`
- `events.csv`
- `counterbalance.csv`

## 9. Prolific Test URL

For a Prolific-style test, use URL parameters such as:

```text
https://accentedness-rating-platform.pages.dev/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}&completion_code=PLACEHOLDER_PROLIFIC_CODE
```

Replace `PLACEHOLDER_PROLIFIC_CODE` with the real Prolific completion code before production.

The final page displays the completion code to the participant.

## 10. Important Checks Before Production

Before running the actual study:

- Replace placeholder practice audio and expert ratings in `app.js`.
- Replace the placeholder Prolific completion code.
- Confirm that `remote_manifest.csv` points to the final audio files.
- Confirm that `remote_manifest.csv` includes `word_number`, `l1_condition`, and `pronunciation_condition` for the counterbalanced stimulus pool.
- Confirm that the intended D1 data location or jurisdiction is acceptable for the ethics and data management plan.
- Confirm that `/admin/` requires the real `ADMIN_TOKEN`.
- Complete at least one full pilot run and download all five CSV files from `/admin/`.

## Local UI Testing Only

For local interface checks without Cloudflare persistence:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/?local=1
```

This mode is only for UI testing. It should not be used for Prolific data collection.
