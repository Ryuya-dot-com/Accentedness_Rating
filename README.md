# Pronunciation Rating Platform

This static browser platform collects three listener-based measures from participant speech recordings:

- `comprehensibility_1_9`: 1 = very easy to understand, 9 = extremely difficult to understand.
- `accentedness_1_9`: 1 = no noticeable accent, 9 = extremely strong accent.
- `intelligibility`: typed spelling of the heard word, with exact-match auto-scoring when the target word is available.

The design follows the listener-based word-level measurement logic in Uchihara (2022), adapted to a 9-point scale and a combined trial format.

## Entry Point

```text
Rating_Platform/index.html
```

From `Experiment/`, preview locally with:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/Rating_Platform/
```

## Workflow

1. Enter a participant ID and session label.
2. Rate daily-life familiarity with Japanese and Chinese separately on 6-point sliders.
3. Load the automatically loaded stimulus manifest, or upload local WAV files for manual testing.
4. Optionally upload a local manifest CSV with metadata.
5. In the server-backed study, the task mode is fixed to `Combined`: ratings and dictation in the same trial.
6. Click `Prepare counterbalanced session` for server-backed stimulus-pool audio, or `Prepare trials` for local manual audio.
7. Click `Start rating`.
8. Complete the practice session:
   - 9 placeholder rating trials: 3 natural, 3 strongly accented, and 3 mild-accent items.
   - 2 placeholder dictation trials.
   - Expert ratings/answers are shown after each practice response.
   - If a rating differs from the expert value by 3 or more points, the participant must briefly explain why.
9. For each sample, play the audio once, then complete the displayed response fields.
10. At the end, the Prolific completion code is displayed.

## GitHub Audio Workflow

Use `remote_manifest.csv` when stimulus recordings are already uploaded to GitHub, GitHub Pages, Cloudflare Pages, or another static host. The default manifest loads automatically. A custom manifest URL is available through the `Use a custom stimulus manifest` option.

For the Cloudflare/Prolific version, server-side counterbalancing is enabled by default. All usable rows in `remote_manifest.csv` form the candidate stimulus pool, and the server assigns each participant to one of 20 counterbalance cells. Use `?manual=1` only for the older manual participant-selection workflow.

Recommended GitHub Pages layout:

```text
Rating_Platform/
  index.html
  remote_manifest.csv
  recordings/
    jpn/
      natural/
      accented/
    chn/
      natural/
      accented/
    ame/
      accented/
```

In this layout, `remote_manifest.csv` can use relative paths:

```csv
audio_file,target_word,participant_id,l1_condition,pronunciation_condition,stimulus_list,word_number
recordings/jpn/natural/list_a_word_006_icicle.wav,icicle,JPN_S01,JPN,natural,A,6
recordings/chn/accented/list_a_word_016_paper.wav,paper,CHN_S01,CHN,accented,A,16
recordings/ame/accented/list_a_word_001_candle.wav,candle,AME_S01,AME,accented,A,1
```

You can also use an absolute `audio_url` column for raw GitHub or another static host:

```csv
audio_url,target_word,participant_id,l1_condition,pronunciation_condition,stimulus_list,word_number
https://example.com/recordings/jpn/natural/list_a_word_006_icicle.wav,icicle,JPN_S01,JPN,natural,A,6
```

Manual participant-selection flow with `?manual=1`:

1. Enter `Participant ID`.
2. Check one or more `Participant ID` values.
3. Click `Prepare checked participants`.
4. Start rating.

The downloaded CSV and assignment JSON include `audio_url`, `source_path`, and `participant_id` so the rated material can be audited later. See `remote_manifest_template.csv` for a minimal template.

## Manifest CSV

The manifest is optional. The platform can infer target words from these existing filename patterns:

```text
001_production_001_icicle.wav
001_japanese_pass01_natural_english_word001_icicle_take01_trial0001_talker_m1_guy.wav
```

Use a manifest when filenames do not include enough metadata or when you want to preserve experimental condition labels.

Supported column names include:

- `audio_file`, `file`, `filename`, or `path`
- `audio_url`, `url`, `source_url`, or `raw_url`
- `target_word`, `word`, `item`, or `expected_word`
- `participant_id`, `participant`, `speaker_id`, or `speaker`
- `l1_condition`, `l1`, `native_language`, `native`, or `speaker_l1`
- `pronunciation_condition`, `pronunciation`, `accent_condition`, `accent`, or `style`
- `stimulus_list`, `list`, `list_id`, or `counterbalance_list`
- `condition`, `pass_condition`, or `variability_condition`
- `talker`, `talker_id`, `voice`, or `voice_alias`
- `pass_number`, `trial_number`, `word_number`, `take_number`
- `spoken_form`, `spoken_text`, or `prompt`
- `practice_note`, `note`, or `notes`

See `manifest_template.csv`.

## Server-side Counterbalancing

The Cloudflare version assigns each participant to one of 20 cells:

- 10 list combinations: `ABCD`, `BCDE`, `CDEF`, `DEFG`, `EFGH`, `FGHI`, `GHIJ`, `HIJA`, `IJAB`, `JABC`
- 2 pronunciation styles: `a` and `b`

Each participant receives 100 main trials:

- 4 stimulus lists per participant.
- 25 trials per stimulus list.
- Per list: 5 `AME`, 10 `JPN`, and 10 `CHN` items.
- `AME` items are treated as accented-only.
- For `JPN` and `CHN`, style `a` means odd word numbers are `natural` and even word numbers are `accented`.
- Style `b` reverses this: odd word numbers are `accented` and even word numbers are `natural`.

The main-trial order is randomized within the session after the server has selected the 100 items.

The randomizer rejects orders where `AME` or `JPN` occurs 3 or more times consecutively.

The server balances cells by completed sessions. If completed counts are tied, it uses assigned/start counts as a secondary criterion so simultaneous starts do not all claim the same cell. Incomplete or dropped sessions are not counted as completed.

Counterbalance reference files:

- `counterbalance_table.csv`: the 20 allocation cells.
- `counterbalance_list_specs.csv`: the A-J word-number ranges.
- `remote_manifest_template.csv`: recommended stimulus manifest columns.

Recommended production manifest columns:

```csv
audio_file,audio_url,target_word,participant_id,l1_condition,pronunciation_condition,stimulus_list,word_number,condition,talker,take_number,spoken_form,practice_note
```

Use `natural` or `accented` in `pronunciation_condition`. The participant-level `pronunciation_style` values `a` and `b` are assigned by the server and should not be used as row-level pronunciation labels.

`stimulus_list` is optional in the code, but including it is recommended. If several rows share the same `L1 x word_number x pronunciation_condition`, the server selects one row per required trial using the session seed. The final order is then randomized with the no-3-consecutive `AME`/`JPN` constraint.

## Cloudflare and GitHub Separation

This project is designed so GitHub stores only application code, public documentation, schemas, templates, and non-sensitive placeholder/demo materials.

Do not commit:

- `wrangler.toml` with real Cloudflare IDs if the project policy treats IDs as internal.
- `.dev.vars`, `.env`, API tokens, or `ADMIN_TOKEN`.
- D1 exports containing participant responses.
- R2 object exports or private audio files that should not be public.
- Prolific participant identifiers or downloaded study data.

Production response data is stored in Cloudflare D1. Large/private audio assets should be served from Cloudflare R2 or another approved storage location. Secrets such as `ADMIN_TOKEN` should be stored with Cloudflare Pages Secrets, not in GitHub.

Cloudflare Pages can still be connected to GitHub for deployment: GitHub provides the code, while runtime data and secrets stay in Cloudflare services.

## Demo Materials

Synthetic demo materials can be generated locally on macOS:

```sh
bash Rating_Platform/scripts/generate_practice_accent_audio.sh
```

This creates:

```text
Rating_Platform/practice_audio/english/{chocolate,coffee,pizza,sofa}.wav
Rating_Platform/practice_audio/japanese/{chocolate,coffee,pizza,sofa}.wav
Rating_Platform/practice_audio/chinese/{chocolate,coffee,pizza,sofa}.wav
Rating_Platform/practice_manifest.csv
```

The English samples use English TTS. The Japanese samples use katakana-shaped forms such as `チョコレート`, and the Chinese samples use comparable loanword/cognate forms such as `巧克力`. These are for interface checks only, not for final data collection.

After generating the files, start the local web server and click `Load demo materials` in the setup screen. The bundled demo loader uses browser `fetch`, so use `http://127.0.0.1:8765/Rating_Platform/` rather than opening `index.html` directly from Finder.

## Built-in Practice Session

The server-backed task automatically starts with a practice session before main ratings.

Current practice audio and expert ratings are placeholders:

- 9 rating items that are not part of the main 50-word set:
  - 3 very natural items
  - 3 strongly accented items
  - 3 mild-accent items
- 2 dictation-only items.

Practice audio paths are placeholders under `practice_training_audio/`. Until final WAV files are supplied, the browser plays a short placeholder tone so the interface flow can be tested. Replace these placeholder paths and expert values in `app.js` before production launch.

## Output

The ZIP contains:

- `{rater}_{session}_pronunciation_ratings.csv`
- `{rater}_{session}_pronunciation_ratings_assignment.json`

Important CSV columns:

- `typed_response`
- `normalized_response`
- `target_word`
- `intelligibility_exact`
- `intelligibility_needs_manual_review`
- `first_key_rt_ms`
- `submit_rt_ms`
- `comprehensibility_1_9`
- `accentedness_1_9`
- `expert_comprehensibility_1_9`
- `expert_accentedness_1_9`
- `practice_feedback`
- `practice_requires_reason`
- `practice_reason`
- `japanese_familiarity_1_6`
- `chinese_familiarity_1_6`

Exact-match scoring is intentionally conservative. Following Uchihara (2022), minor misspellings can be treated as correct during later manual coding; non-exact rows are flagged with `intelligibility_needs_manual_review = 1`.

## Server-backed Cloudflare Version

This folder also contains a Cloudflare Pages + Functions + D1 version for Prolific-style data collection where raters should not email downloaded files.

Deployment steps are documented in [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md).

Server-side files:

```text
functions/api/
  session/start.js       # create a rater session and persist trial order
  trial.js               # save each rating trial immediately
  event.js               # save UI/event logs
  session/complete.js    # mark a session complete
  admin/summary.js       # admin counts
  admin/export/[dataset].js
admin/
  index.html             # researcher export page
db/schema.sql            # D1 schema
db/migrations/           # one-time migrations for existing D1 databases
wrangler.toml.example    # binding example
```

Apply the D1 schema after creating a D1 database:

```sh
wrangler d1 execute <DB_NAME> --file=./db/schema.sql
```

If the D1 database was created before counterbalancing was added, run this migration once instead of recreating the database:

```sh
wrangler d1 execute <DB_NAME> --file=./db/migrations/0002_counterbalance.sql
```

Configure the Pages Functions D1 binding as `DB`. Set an admin token as a Cloudflare secret:

```sh
wrangler pages secret put ADMIN_TOKEN
```

Rater responses are saved trial-by-trial to D1. The local ZIP download remains as a backup, but the server-backed workflow advances only after the current response has been saved.

The researcher export page is:

```text
/admin/
```

Available CSV exports:

- `ratings.csv`: all practice and main responses, response times, intelligibility fields, 9-point rating values, practice feedback/reasons, familiarity ratings, and audio metadata.
- `sessions.csv`: participant/session/prolific metadata, familiarity ratings, completion code, counterbalance cell, and completion status.
- `assignments.csv`: trial order shown to each participant, including counterbalance list/L1/pronunciation fields.
- `events.csv`: session start, trial display, audio playback, first key, save, pause, and completion logs.
- `counterbalance.csv`: cell allocation logs and completion status.

For local-only testing without a Cloudflare API, open the page with `?local=1`. Do not use `?local=1` for Prolific data collection because it permits advancing without server persistence.
