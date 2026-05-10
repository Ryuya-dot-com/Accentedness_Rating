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

The platform is CSV-driven, but raters do not need to type a manifest URL or choose experimental conditions during normal use. The default `scoring_manifest_demo.csv` loads automatically, then the setup screen shows `Rater ID`, `Task to score`, and participant checkboxes. A custom manifest URL is available only through `Use a different scoring manifest`.

Recommended rater flow:

1. Enter `Rater ID`.
2. Choose `Task to score`.
3. Check the participant ID(s) assigned to the rater.
4. Click `Prepare scoring queue`.
5. Click `Start scoring`.

Experimental condition and test-session metadata such as `E`, `J`, and `C` should be represented in the manifest with `dataset_id` and `test_session`. Raters do not select those fields; they are carried through to the CSV/JSON exports.

The scoring queue is shuffled automatically. The deterministic seed is based on the rater ID plus the selected test, manifest, and participant set, so the same rater assignment can be resumed with the same order.

The bundled placeholder manifest includes 24 synthetic MP3 files under `recordings/placeholders/`: `P001` through `P006`, with four recordings per participant. Experimental condition and test-session metadata remain in `scoring_manifest_demo.csv` and the exported CSV/JSON, but raters only see anonymized participant IDs.

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
        001_trial001_icicle.mp3
      picture_naming/
        001_icicle.mp3
```

For recordings collected with `Accentedness_Tests`, generate this manifest from the `Accentedness_Tests` repository root with:

```bash
python3 scripts/build_downstream_manifests.py path/to/*_tests_vocabulary_task_results.zip -o downstream_upload
```

Then copy `downstream_upload/scoring_manifest.csv` and `downstream_upload/recordings/` into this repository or another static host.

Required columns:

- `participant_id`
- `task`: `l2_to_l1` or `picture_naming`
- `recording_file`, `audio_file`, or `audio_url`

Recommended columns:

- `dataset_id`
- `test_session`: for example `E`, `J`, or `C`
- `trial_number`
- `target_word`
- `expected_response`
- `expected_language`
- `stimulus_end_ms` for L2-to-L1 latency reference
- `image_onset_ms_rel` for Picture Naming latency reference
- `onset_ms_auto`
- `offset_ms_auto`
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

Timing controls:

- After playback finishes, click `Replay` to listen again. Playback starts are saved as `audio_play_count`.
- Red marker: response onset.
- Orange marker: response offset.
- Click `Move onset` or `Move offset`, then click or drag on the waveform to set the marker.
- Drag an existing marker directly to adjust it.
- `Clear offset` removes the rater offset marker when offset scoring is not needed.

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
- `dataset_id`
- `test_session`
- `participant_id`
- `task`
- `trial_number`
- `target_word`
- `expected_response`
- `audio_url`
- `audio_play_count`
- `accuracy_score`
- `onset_status`
- `onset_ms_auto`
- `onset_ms_rater`
- `offset_status`
- `offset_ms_auto`
- `offset_ms_rater`
- `duration_ms_rater`
- `latency_ms_auto`
- `latency_ms_rater`
- `notes`

Progress is saved in browser `localStorage` for the same rater, session, manifest URL, task filter, and participant set.
