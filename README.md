# Production Scoring Platform

Static browser scorer for participant recordings from:

- L2-to-L1 translation
- Picture Naming

It is modeled after the workflow in [Variability_Scoring](https://github.com/Ryuya-dot-com/Variability_Scoring): raters listen to each recording, verify or correct the response onset, assign an accuracy score, and export scoring data.

## Public Entry Point

```text
https://ryuya-dot-com.github.io/Accentedness_Rating/
```

Local preview:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

## Participant Checkbox Workflow

The platform is CSV-driven, but raters do not need to type a manifest URL during normal use. The default `scoring_manifest_demo.csv` loads automatically, then the setup screen shows task checkboxes and participant checkboxes. A custom manifest URL is available only through `Use a different scoring manifest`.

Recommended rater flow:

1. Enter `Rater ID`.
2. Check the task type(s) to score.
3. Check the participant ID(s) assigned to the rater.
4. Click `Prepare selected participants`.
5. Click `Start scoring`.

Upload recordings to GitHub Pages, raw GitHub, or another static host, and keep the manifest next to the platform or point the custom manifest option to the manifest CSV.

Important: uploaded participant recordings must be anonymized before publication. Do not include names, student numbers, email addresses, or other direct identifiers in folder names, filenames, manifest rows, or GitHub commit history.

Recommended GitHub Pages layout:

```text
Accentedness_Rating/
  index.html
  scoring_manifest.csv
  recordings/
    001/
      l2_to_l1/
        001_trial001_icicle.wav
      picture_naming/
        001_icicle.wav
```

Required columns:

- `participant_id`
- `task`: `l2_to_l1` or `picture_naming`
- `audio_file` or `audio_url`

Recommended columns:

- `trial_number`
- `target_word`
- `expected_response`
- `expected_language`
- `stimulus_end_ms` for L2-to-L1 latency reference
- `image_onset_ms_rel` for Picture Naming latency reference
- `onset_ms_auto`
- `latency_ms_auto`
- `condition`
- `accent_condition`
- `list`
- `word_number`
- `image_file` or `image_url` for Picture Naming

Relative paths in `audio_file` and `image_file` are resolved relative to the manifest URL. Absolute `audio_url` and `image_url` values can point to another static host.

See:

```text
scoring_manifest_template.csv
scoring_manifest_demo.csv
```

## Scoring

Accuracy scores:

- `NR`: no response
- `0`: incorrect
- `0.5`: partially correct
- `1`: correct

Onset statuses:

- `confirmed`
- `corrected`
- `manual`
- `no_speech`

For L2-to-L1, `latency_ms_rater = onset_ms_rater - stimulus_end_ms`.

For Picture Naming, `latency_ms_rater = onset_ms_rater - image_onset_ms_rel`.

## Output

Exports include one row per prepared recording, including unscored rows. Main output fields include:

- `rater_id`
- `session_id`
- `participant_id`
- `task`
- `trial_number`
- `target_word`
- `expected_response`
- `audio_url`
- `accuracy_score`
- `onset_status`
- `onset_ms_auto`
- `onset_ms_rater`
- `latency_ms_auto`
- `latency_ms_rater`
- `notes`

Progress is saved in browser `localStorage` for the same rater, session, manifest URL, task filter, and participant set.
