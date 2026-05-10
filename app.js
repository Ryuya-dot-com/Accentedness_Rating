(function () {
  "use strict";

  const VERSION = "production_scoring_v0.5.6";
  const DEFAULT_MANIFEST_URL = "scoring_manifest_demo.csv";
  const AUDIO_URL_COLUMNS = ["audio_url", "url", "source_url", "raw_url"];
  const AUDIO_FILE_COLUMNS = ["recording_file", "audio_file", "file", "filename", "path"];
  const IMAGE_URL_COLUMNS = ["image_url", "picture_url", "stimulus_image_url"];
  const IMAGE_FILE_COLUMNS = ["image_file", "picture_file", "stimulus_image", "image"];
  const EXPORT_COLUMNS = [
    "platform_version", "rater_id", "session_id", "manifest_url", "dataset_id", "test_session", "scored_at",
    "row_index", "participant_id", "task", "trial_number", "target_word",
    "expected_response", "expected_language", "audio_url", "source_path", "audio_play_count",
    "image_url", "condition", "accent_condition", "list", "word_number",
    "accuracy_score", "onset_status", "onset_ms_auto", "onset_ms_rater",
    "offset_status", "offset_ms_auto", "offset_ms_rater", "duration_ms_rater",
    "reference_ms", "latency_ms_auto", "latency_ms_rater", "notes"
  ];

  const els = {
    versionLabel: document.getElementById("version-label"),
    setupPanel: document.getElementById("setup-panel"),
    scoringPanel: document.getElementById("scoring-panel"),
    setupStatus: document.getElementById("setup-status"),
    statusRows: document.getElementById("status-rows"),
    statusParticipants: document.getElementById("status-participants"),
    statusAssigned: document.getElementById("status-assigned"),
    statusTrials: document.getElementById("status-trials"),
    raterId: document.getElementById("rater-id"),
    sessionId: document.getElementById("session-id"),
    customManifestToggle: document.getElementById("custom-manifest-toggle"),
    customManifestField: document.getElementById("custom-manifest-field"),
    sourceSummary: document.getElementById("source-summary"),
    manifestUrl: document.getElementById("manifest-url"),
    testSelect: document.getElementById("test-select"),
    loadManifestBtn: document.getElementById("load-manifest-btn"),
    selectAllBtn: document.getElementById("select-all-btn"),
    clearAllBtn: document.getElementById("clear-all-btn"),
    participantGrid: document.getElementById("participant-grid"),
    prepareBtn: document.getElementById("prepare-btn"),
    startBtn: document.getElementById("start-btn"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    exportJsonBtn: document.getElementById("export-json-btn"),
    setupLog: document.getElementById("setup-log"),
    trialPhase: document.getElementById("trial-phase"),
    trialTitle: document.getElementById("trial-title"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    trialStrip: document.getElementById("trial-strip"),
    railParticipant: document.getElementById("rail-participant"),
    railTask: document.getElementById("rail-task"),
    railTrial: document.getElementById("rail-trial"),
    railSaved: document.getElementById("rail-saved"),
    backBtn: document.getElementById("back-btn"),
    prevBtn: document.getElementById("prev-btn"),
    nextUnscoredBtn: document.getElementById("next-unscored-btn"),
    nextBtn: document.getElementById("next-btn"),
    taskBadge: document.getElementById("task-badge"),
    targetWord: document.getElementById("target-word"),
    expectedResponse: document.getElementById("expected-response"),
    trialMetadata: document.getElementById("trial-metadata"),
    imageSlot: document.getElementById("image-slot"),
    stimulusImage: document.getElementById("stimulus-image"),
    playBtn: document.getElementById("play-btn"),
    stopBtn: document.getElementById("stop-btn"),
    playOnsetBtn: document.getElementById("play-onset-btn"),
    speedSelect: document.getElementById("speed-select"),
    waveformCanvas: document.getElementById("waveform-canvas"),
    audioTime: document.getElementById("audio-time"),
    audioStatus: document.getElementById("audio-status"),
    accuracyCheck: document.getElementById("accuracy-check"),
    onsetCheck: document.getElementById("onset-check"),
    offsetCheck: document.getElementById("offset-check"),
    latencyCheck: document.getElementById("latency-check"),
    scoreButtons: document.getElementById("score-buttons"),
    onsetButtons: document.getElementById("onset-buttons"),
    onsetInput: document.getElementById("onset-input"),
    offsetInput: document.getElementById("offset-input"),
    applyOnsetBtn: document.getElementById("apply-onset-btn"),
    setOnsetMarkerBtn: document.getElementById("set-onset-marker-btn"),
    setOffsetMarkerBtn: document.getElementById("set-offset-marker-btn"),
    clearOffsetBtn: document.getElementById("clear-offset-btn"),
    scoreHint: document.getElementById("score-hint"),
    notesInput: document.getElementById("notes-input"),
  };

  const state = {
    manifestItems: [],
    manifestUrl: "",
    assignedParticipants: [],
    items: [],
    currentIndex: 0,
    scores: {},
    sessionKey: "",
    currentAudio: null,
    animationId: null,
    waveform: null,
    markerMode: null,
    draggingMarker: null,
    audioReady: false,
    audioPlayCount: 0,
  };

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function valueFrom(row, names) {
    for (const name of names) {
      const key = normalizeHeader(name);
      if (row && row[key] !== undefined && String(row[key]).trim() !== "") {
        return String(row[key]).trim();
      }
    }
    return "";
  }

  function numberFrom(row, names) {
    const value = valueFrom(row, names);
    if (value === "") return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeTask(value, sourcePath = "") {
    const raw = String(value || sourcePath || "").toLowerCase().replace(/[-\s]+/g, "_");
    if (raw.includes("picture") || raw.includes("naming") || raw === "pn") return "picture_naming";
    if (raw.includes("l2") || raw.includes("translation") || raw.includes("l1")) return "l2_to_l1";
    return "picture_naming";
  }

  function taskLabel(value) {
    if (value === "l2_to_l1") return "L2-to-L1";
    if (value === "picture_naming") return "Picture Naming";
    return "Task";
  }

  function selectedTestLabel() {
    const value = els.testSelect.value;
    if (value === "l2_to_l1") return "L2-to-L1 only";
    if (value === "picture_naming") return "Picture Naming only";
    return "Both tasks";
  }

  function csvCell(value) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function rowsToCsv(rows) {
    return [
      EXPORT_COLUMNS.map(csvCell).join(","),
      ...rows.map((row) => EXPORT_COLUMNS.map((key) => csvCell(row[key])).join(",")),
    ].join("\n");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map(normalizeHeader);
    return rows.slice(1)
      .filter((values) => values.some((value) => String(value).trim() !== ""))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }

  function resolveUrl(value, baseUrl = window.location.href) {
    if (!value) return "";
    try {
      return new URL(value, baseUrl).toString();
    } catch (error) {
      return String(value || "");
    }
  }

  function fileNameFromPath(value) {
    return String(value || "")
      .replaceAll("\\", "/")
      .split("/")
      .pop();
  }

  function sanitize(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "session";
  }

  function hashString(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function rng() {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, seedText) {
    const out = items.slice();
    const rng = mulberry32(hashString(seedText));
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function setSetupStatus(text, ready = false) {
    els.setupStatus.textContent = text;
    els.setupStatus.dataset.ready = ready ? "true" : "false";
  }

  function setLog(text) {
    els.setupLog.textContent = text;
  }

  function showSetup() {
    els.setupPanel.classList.remove("hidden");
    els.scoringPanel.classList.add("hidden");
    cleanupAudio();
  }

  function showScoring() {
    els.setupPanel.classList.add("hidden");
    els.scoringPanel.classList.remove("hidden");
  }

  function participantIdFromRow(row) {
    return valueFrom(row, ["participant_id", "participant", "speaker_id", "speaker", "subject_id"]);
  }

  function trialNumberFromRow(row, fallback) {
    return valueFrom(row, ["trial_number", "trial", "item_trial", "trial_index"]) || String(fallback);
  }

  function normalizeManifestRow(row, index, manifestUrl) {
    const participantId = participantIdFromRow(row);
    const sourcePath = valueFrom(row, AUDIO_URL_COLUMNS) || valueFrom(row, AUDIO_FILE_COLUMNS);
    if (!participantId || !sourcePath) return null;

    const task = normalizeTask(valueFrom(row, ["task", "test_type", "test", "phase"]), sourcePath);
    const imagePath = valueFrom(row, IMAGE_URL_COLUMNS) || valueFrom(row, IMAGE_FILE_COLUMNS);
    let referenceMs = task === "l2_to_l1"
      ? numberFrom(row, ["stimulus_end_ms", "playback_end_ms_rel", "playback_end_ms", "reference_ms"])
      : numberFrom(row, ["image_onset_ms_rel", "image_onset_ms", "stimulus_onset_ms", "reference_ms"]);
    if (task === "picture_naming" && referenceMs == null) referenceMs = 0;

    const trialNumber = trialNumberFromRow(row, index + 1);
    const testSession = valueFrom(row, ["test_session", "session_code", "test_session_code", "audio_session"]);
    const datasetId = valueFrom(row, ["dataset_id", "dataset", "recording_set", "data_set", "upload_batch"]) ||
      (testSession ? `session_${testSession}` : "default");
    const item = {
      id: `${participantId}_${task}_${trialNumber}_${index + 1}`,
      row_index: index + 1,
      dataset_id: datasetId,
      test_session: testSession,
      participant_id: participantId,
      task,
      trial_number: trialNumber,
      target_word: valueFrom(row, ["target_word", "word", "item", "expected_word"]),
      expected_response: valueFrom(row, ["expected_response", "response", "translation", "l1_translation", "correct_answer", "expected_word"]),
      expected_language: valueFrom(row, ["expected_language", "response_language", "language"]) || (task === "l2_to_l1" ? "L1" : "L2"),
      audio_url: resolveUrl(sourcePath, manifestUrl),
      source_path: sourcePath,
      audio_file_name: fileNameFromPath(sourcePath),
      image_url: imagePath ? resolveUrl(imagePath, manifestUrl) : "",
      condition: valueFrom(row, ["condition", "timing", "session", "phase_condition"]),
      accent_condition: valueFrom(row, ["accent_condition", "accent", "native_language", "l1"]),
      list: valueFrom(row, ["list", "list_number"]),
      word_number: valueFrom(row, ["word_number", "word_id", "item_id"]),
      onset_ms_auto: numberFrom(row, ["onset_ms_auto", "onset_ms_from_recording_start", "auto_onset_ms"]),
      offset_ms_auto: numberFrom(row, ["offset_ms_auto", "offset_ms_from_recording_start", "auto_offset_ms", "response_offset_ms", "speech_offset_ms"]),
      reference_ms: referenceMs,
      latency_ms_auto: numberFrom(row, ["latency_ms_auto", "latency_ms", "latency_ms_from_playback_end", "latency_ms_from_image_onset"]),
      raw: row,
    };

    if (!item.expected_response) item.expected_response = item.target_word;
    return item;
  }

  function manifestInput() {
    if (!els.customManifestToggle.checked) return DEFAULT_MANIFEST_URL;
    return els.manifestUrl.value.trim() || DEFAULT_MANIFEST_URL;
  }

  function selectedTaskSet() {
    const tasks = new Set();
    if (els.testSelect.value === "all" || els.testSelect.value === "l2_to_l1") tasks.add("l2_to_l1");
    if (els.testSelect.value === "all" || els.testSelect.value === "picture_naming") tasks.add("picture_naming");
    return tasks;
  }

  function selectedTaskKey() {
    return [...selectedTaskSet()].sort().join("|") || "none";
  }

  function syncCustomManifestVisibility() {
    els.customManifestField.classList.toggle("hidden", !els.customManifestToggle.checked);
    els.sourceSummary.textContent = els.customManifestToggle.checked
      ? "Custom manifest enabled"
      : `Default: ${DEFAULT_MANIFEST_URL}`;
  }

  async function fetchCsv(url) {
    const resolvedUrl = resolveUrl(url || DEFAULT_MANIFEST_URL);
    const response = await fetch(resolvedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${resolvedUrl} (${response.status})`);
    return { rows: parseCsv(await response.text()), url: resolvedUrl };
  }

  async function loadManifest() {
    els.loadManifestBtn.disabled = true;
    setSetupStatus("Loading manifest");
    setLog(`Loading recordings:\n${manifestInput()}`);

    const { rows, url } = await fetchCsv(manifestInput());
    const items = rows.map((row, index) => normalizeManifestRow(row, index, url)).filter(Boolean);
    if (!items.length) {
      state.manifestItems = [];
      state.manifestUrl = "";
      renderParticipants();
      throw new Error("Manifest rows need participant_id and audio_file or audio_url.");
    }

    state.manifestItems = items;
    state.manifestUrl = url;
    state.items = [];
    state.assignedParticipants = [];
    state.scores = {};
    updateSetupSummary();
    renderParticipants();
    els.sourceSummary.textContent = els.customManifestToggle.checked ? `Loaded: ${url}` : `Default loaded: ${DEFAULT_MANIFEST_URL}`;
    const datasetCount = new Set(items.map((item) => item.dataset_id)).size;
    setLog([
      `manifest_url: ${url}`,
      `datasets: ${datasetCount}`,
      `usable_rows: ${items.length}`,
      `l2_to_l1: ${items.filter((item) => item.task === "l2_to_l1").length}`,
      `picture_naming: ${items.filter((item) => item.task === "picture_naming").length}`,
    ].join("\n"));
    updateSetupSummary();
    els.loadManifestBtn.disabled = false;
  }

  function filteredManifestItems() {
    const tasks = selectedTaskSet();
    if (!tasks.size) return [];
    return state.manifestItems.filter((item) => tasks.has(item.task));
  }

  function clearPreparedQueue() {
    state.items = [];
    state.assignedParticipants = [];
    state.scores = {};
    state.currentIndex = 0;
    state.sessionKey = "";
    els.startBtn.disabled = true;
    els.exportCsvBtn.disabled = true;
    els.exportJsonBtn.disabled = true;
  }

  function renderParticipants() {
    const items = filteredManifestItems();
    const counts = new Map();
    items.forEach((item) => {
      const count = counts.get(item.participant_id) || { total: 0, l2_to_l1: 0, picture_naming: 0 };
      count.total += 1;
      if (item.task === "l2_to_l1") count.l2_to_l1 += 1;
      if (item.task === "picture_naming") count.picture_naming += 1;
      counts.set(item.participant_id, count);
    });

    const participants = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    els.participantGrid.innerHTML = "";
    els.participantGrid.classList.toggle("empty", participants.length === 0);
    if (!participants.length) {
      els.participantGrid.textContent = state.manifestItems.length ? "No participants for the selected test." : "Loading participants...";
    } else {
      participants.forEach(([participantId, info]) => {
        const label = document.createElement("label");
        label.className = "participant-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = participantId;
        input.checked = false;
        input.addEventListener("change", () => {
          clearPreparedQueue();
          updateSetupSummary();
        });
        const text = document.createTextNode(participantId);
        const meta = document.createElement("span");
        meta.textContent = [
          info.l2_to_l1 ? `${info.l2_to_l1} L2` : "",
          info.picture_naming ? `${info.picture_naming} PN` : "",
        ].filter(Boolean).join(" · ") || `${info.total} files`;
        label.append(input, text, meta);
        els.participantGrid.append(label);
      });
    }

    const enabled = participants.length > 0;
    els.selectAllBtn.disabled = !enabled;
    els.clearAllBtn.disabled = !enabled;
    updateSetupSummary();
  }

  function selectedParticipants() {
    return [...els.participantGrid.querySelectorAll("input:checked")].map((input) => input.value);
  }

  function updateSetupSummary() {
    const items = filteredManifestItems();
    const participants = new Set(items.map((item) => item.participant_id));
    const assigned = selectedParticipants();
    const assignedSet = new Set(assigned);
    const trials = items.filter((item) => assignedSet.has(item.participant_id)).length;

    els.statusRows.textContent = String(items.length);
    els.statusParticipants.textContent = String(participants.size);
    els.statusAssigned.textContent = selectedTestLabel();
    els.statusTrials.textContent = String(trials);

    const hasRater = Boolean(els.raterId.value.trim());
    const taskCount = selectedTaskSet().size;
    els.prepareBtn.disabled = !(hasRater && assigned.length && trials);
    if (state.items.length) {
      setSetupStatus("Ready", true);
    } else if (!state.manifestItems.length) {
      setSetupStatus("Loading participant list");
    } else if (!taskCount) {
      setSetupStatus("Tasks needed");
    } else if (!hasRater) {
      setSetupStatus("Rater needed");
    } else if (!assigned.length) {
      setSetupStatus("Participants needed");
    } else if (trials) {
      setSetupStatus("Ready to prepare");
    }
  }

  function makeSessionKey() {
    const seed = [
      els.raterId.value.trim(),
      state.manifestUrl,
      selectedTaskKey(),
      state.assignedParticipants.join("|"),
    ].join("::");
    return `productionScoring_${hashString(seed)}`;
  }

  function sessionIdValue() {
    return els.sessionId.value.trim() || "auto";
  }

  function queueSeed(raterId, assigned) {
    return [
      raterId,
      state.manifestUrl,
      selectedTaskKey(),
      assigned.join("|"),
    ].join("::");
  }

  function exportBaseName() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return `${sanitize(els.raterId.value)}_${sanitize(selectedTaskKey())}_${date}_production_scoring`;
  }

  function loadSavedSession(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveSession() {
    if (!state.sessionKey) return;
    localStorage.setItem(state.sessionKey, JSON.stringify({
      platform_version: VERSION,
      rater_id: els.raterId.value.trim(),
      session_id: sessionIdValue(),
      manifest_url: state.manifestUrl,
      task_filter: selectedTaskKey(),
      assigned_participants: state.assignedParticipants,
      current_index: state.currentIndex,
      scores: state.scores,
      saved_at: new Date().toISOString(),
    }));
  }

  function prepareScoring() {
    const raterId = els.raterId.value.trim();
    if (!raterId) {
      setSetupStatus("Rater needed");
      els.raterId.focus();
      return;
    }
    const assigned = selectedParticipants();
    const assignedSet = new Set(assigned);
    const selectedItems = filteredManifestItems()
      .filter((item) => assignedSet.has(item.participant_id))
      .sort((a, b) => (
        a.participant_id.localeCompare(b.participant_id, undefined, { numeric: true, sensitivity: "base" }) ||
        Number(a.trial_number) - Number(b.trial_number) ||
        a.row_index - b.row_index
      ));
    const seed = queueSeed(raterId, assigned);
    const prepared = shuffle(selectedItems, seed);

    state.assignedParticipants = assigned;
    state.items = prepared;
    state.currentIndex = 0;
    state.sessionKey = makeSessionKey();
    state.scores = {};

    const saved = loadSavedSession(state.sessionKey);
    if (saved && saved.scores) {
      state.scores = saved.scores;
      state.currentIndex = Math.min(saved.current_index || 0, Math.max(0, state.items.length - 1));
    }

    els.startBtn.disabled = state.items.length === 0;
    els.exportCsvBtn.disabled = state.items.length === 0;
    els.exportJsonBtn.disabled = state.items.length === 0;
    updateSetupSummary();
    setSetupStatus("Ready", true);
    setLog([
      `task_filter: ${selectedTestLabel()}`,
      `assigned_participants: ${assigned.join(", ")}`,
      `prepared_trials: ${state.items.length}`,
      `shuffle_seed: rater_id`,
      `saved_scores_loaded: ${Object.keys(state.scores).length}`,
      `session_key: ${state.sessionKey}`,
    ].join("\n"));
    saveSession();
  }

  function startScoring() {
    if (!state.items.length) return;
    showScoring();
    showItem(state.currentIndex);
  }

  function currentItem() {
    return state.items[state.currentIndex] || null;
  }

  function scoreFor(item) {
    return item ? (state.scores[item.id] || {}) : {};
  }

  function isComplete(item) {
    const score = scoreFor(item);
    if (score.accuracy_score == null) return false;
    if (score.accuracy_score === "NR") return score.onset_status === "no_speech";
    return Boolean(score.onset_status);
  }

  function hasPartialScore(item) {
    const score = scoreFor(item);
    return Boolean(
      score.accuracy_score != null ||
      score.onset_status ||
      score.offset_status ||
      score.offset_ms_rater != null ||
      score.notes
    );
  }

  function latencyFor(item, score) {
    const onsetMs = score.accuracy_score === "NR" ? null : score.onset_ms_rater;
    if (onsetMs == null || item.reference_ms == null) return null;
    const latency = Number(onsetMs) - Number(item.reference_ms);
    return Number.isFinite(latency) ? latency : null;
  }

  function durationFor(item, score) {
    const onsetMs = markerOnsetMs(item, score);
    const offsetMs = markerOffsetMs(item, score);
    if (onsetMs == null || offsetMs == null) return null;
    const duration = Number(offsetMs) - Number(onsetMs);
    return Number.isFinite(duration) && duration >= 0 ? duration : null;
  }

  function completionLabel(item) {
    if (isComplete(item)) return "Complete";
    if (hasPartialScore(item)) return "Partial";
    return "Open";
  }

  function patchScore(item, patch) {
    if (!item) return;
    state.scores[item.id] = {
      ...scoreFor(item),
      ...patch,
      scored_at: new Date().toISOString(),
    };
    saveSession();
    updateProgress();
  }

  function recordAudioPlayback(item) {
    if (!item) return;
    const score = scoreFor(item);
    const count = Number(score.audio_play_count || 0) + 1;
    state.audioPlayCount = count;
    state.scores[item.id] = {
      ...score,
      audio_play_count: count,
    };
    saveSession();
  }

  function showItem(index) {
    cleanupAudio();
    state.currentIndex = Math.max(0, Math.min(index, state.items.length - 1));
    setMarkerMode(null);
    saveSession();

    const item = currentItem();
    if (!item) return;
    const score = scoreFor(item);

    els.trialPhase.textContent = `Sample ${state.currentIndex + 1} of ${state.items.length}`;
    els.trialTitle.textContent = item.audio_file_name || "Recording";
    els.railParticipant.textContent = item.participant_id;
    els.railTask.textContent = taskLabel(item.task);
    els.railTrial.textContent = String(item.trial_number || item.row_index);
    els.taskBadge.textContent = taskLabel(item.task);
    els.targetWord.textContent = item.target_word || item.expected_response || "Target unavailable";
    els.expectedResponse.textContent = item.expected_response
      ? `Expected: ${item.expected_response} (${item.expected_language})`
      : "Expected response unavailable";
    els.trialMetadata.textContent = [
      item.dataset_id ? `dataset=${item.dataset_id}` : "",
      item.test_session ? `test=${item.test_session}` : "",
      item.condition ? `condition=${item.condition}` : "",
      item.accent_condition ? `accent=${item.accent_condition}` : "",
      item.list ? `list=${item.list}` : "",
      item.word_number ? `word=${item.word_number}` : "",
    ].filter(Boolean).join(" · ");

    if (item.image_url) {
      els.stimulusImage.src = item.image_url;
      els.stimulusImage.alt = item.target_word || "Stimulus image";
      els.imageSlot.classList.remove("hidden");
    } else {
      els.imageSlot.classList.add("hidden");
      els.stimulusImage.removeAttribute("src");
    }

    els.scoreHint.textContent = item.task === "l2_to_l1"
      ? "L2-to-L1: use 1 for the correct L1 answer; 0.5 is usually unnecessary."
      : "Picture Naming: use 0.5 for limited within-syllable phoneme errors.";
    els.notesInput.value = score.notes || "";
    els.onsetInput.value = score.onset_ms_rater != null
      ? score.onset_ms_rater
      : (item.onset_ms_auto != null ? item.onset_ms_auto.toFixed(1) : "");
    els.offsetInput.value = score.offset_ms_rater != null
      ? score.offset_ms_rater
      : (item.offset_ms_auto != null ? item.offset_ms_auto.toFixed(1) : "");

    updateActiveButtons();
    updateTrialChecks();
    updateProgress();
    loadAudio(item);
  }

  function updateActiveButtons() {
    const item = currentItem();
    const score = scoreFor(item);
    els.scoreButtons.querySelectorAll(".score-button").forEach((button) => {
      const active = String(score.accuracy_score) === button.dataset.score;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    els.onsetButtons.querySelectorAll(".onset-button").forEach((button) => {
      const active = score.onset_status === button.dataset.onset;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    [els.setOnsetMarkerBtn, els.setOffsetMarkerBtn].forEach((button) => {
      const active = state.markerMode === button.dataset.marker;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setCheck(el, stateName, label) {
    el.dataset.state = stateName;
    el.querySelector("strong").textContent = label;
  }

  function setMarkerMode(marker) {
    state.markerMode = marker;
    state.draggingMarker = null;
    els.waveformCanvas.classList.toggle("manual-onset", Boolean(marker));
    els.waveformCanvas.classList.remove("marker-dragging");
    updateActiveButtons();
  }

  function updateTrialChecks() {
    const item = currentItem();
    if (!item) return;
    const score = scoreFor(item);
    const hasAccuracy = score.accuracy_score != null;
    const hasOnset = score.accuracy_score === "NR"
      ? score.onset_status === "no_speech"
      : Boolean(score.onset_status);
    const latency = latencyFor(item, score);
    const offsetMs = markerOffsetMs(item, score);
    const duration = durationFor(item, score);

    setCheck(els.accuracyCheck, hasAccuracy ? "done" : "pending", hasAccuracy ? String(score.accuracy_score) : "Pending");
    setCheck(els.onsetCheck, hasOnset ? "done" : "pending", hasOnset ? score.onset_status.replace("_", " ") : "Pending");
    const offsetLabel = offsetMs == null
      ? "-"
      : `${Number(offsetMs).toFixed(1)} ms${duration == null ? "" : ` (${duration.toFixed(1)} ms)`}`;
    setCheck(els.offsetCheck, offsetMs == null ? "neutral" : "done", offsetLabel);
    setCheck(els.latencyCheck, latency == null ? "neutral" : "done", latency == null ? "-" : `${latency.toFixed(1)} ms`);
    els.playOnsetBtn.disabled = !state.audioReady || markerOnsetMs(item, score) == null;
  }

  function cleanupAudio() {
    if (state.animationId) cancelAnimationFrame(state.animationId);
    state.animationId = null;
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.src = "";
      state.currentAudio = null;
    }
    state.audioReady = false;
    state.draggingMarker = null;
    els.waveformCanvas.classList.remove("marker-dragging");
  }

  function loadAudio(item) {
    state.waveform = null;
    state.audioReady = false;
    state.audioPlayCount = Number(scoreFor(item).audio_play_count || 0);
    drawWaveform();
    els.audioStatus.textContent = "Loading audio...";
    els.audioTime.textContent = "0.000s / 0.000s";
    els.playBtn.textContent = "Play";
    els.playBtn.disabled = true;
    els.stopBtn.disabled = true;
    els.playOnsetBtn.disabled = true;

    const audio = new Audio(item.audio_url);
    audio.preload = "auto";
    audio.playbackRate = Number.parseFloat(els.speedSelect.value) || 1;
    state.currentAudio = audio;

    audio.addEventListener("loadedmetadata", () => {
      state.audioReady = true;
      els.playBtn.disabled = false;
      els.stopBtn.disabled = false;
      updateTrialChecks();
      updateAudioTime();
      drawWaveform();
      if (!state.waveform) els.audioStatus.textContent = "Audio ready.";
    });
    audio.addEventListener("timeupdate", () => {
      updateAudioTime();
      drawWaveform();
    });
    audio.addEventListener("ended", () => {
      els.playBtn.textContent = "Replay";
      drawWaveform();
    });
    audio.addEventListener("error", () => {
      state.audioReady = false;
      els.playBtn.disabled = true;
      els.stopBtn.disabled = true;
      els.playOnsetBtn.disabled = true;
      els.audioStatus.textContent = "Audio could not be loaded. Check the manifest path.";
      console.warn("Audio could not be loaded:", item.audio_url);
    });

    loadWaveform(item.audio_url)
      .then((waveform) => {
        if (currentItem() !== item) return;
        state.waveform = waveform;
        els.audioStatus.textContent = "Waveform ready.";
        drawWaveform();
      })
      .catch(() => {
        if (currentItem() === item) {
          els.audioStatus.textContent = "Audio ready. Waveform unavailable for this host.";
          drawWaveform();
        }
      });
  }

  async function loadWaveform(audioUrl) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("AudioContext unavailable");
    const response = await fetch(audioUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not fetch audio (${response.status})`);
    const buffer = await response.arrayBuffer();
    const context = new AudioContextClass();
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    await context.close();

    const data = audioBuffer.getChannelData(0);
    const sampleCount = Math.min(1400, Math.max(300, Math.floor(data.length / 200)));
    const blockSize = Math.max(1, Math.floor(data.length / sampleCount));
    const peaks = [];
    for (let i = 0; i < sampleCount; i += 1) {
      let max = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, data.length);
      for (let j = start; j < end; j += 1) {
        const value = Math.abs(data[j]);
        if (value > max) max = value;
      }
      peaks.push(max);
    }
    return { peaks, duration: audioBuffer.duration };
  }

  function markerOnsetMs(item, score) {
    if (!item) return null;
    if (score.accuracy_score === "NR" || score.onset_status === "no_speech") return null;
    if (score.onset_ms_rater != null && score.onset_ms_rater !== "") return Number(score.onset_ms_rater);
    return item.onset_ms_auto;
  }

  function markerOffsetMs(item, score) {
    if (!item) return null;
    if (score.accuracy_score === "NR" || score.onset_status === "no_speech") return null;
    if (score.offset_status === "cleared") return null;
    if (score.offset_ms_rater != null && score.offset_ms_rater !== "") return Number(score.offset_ms_rater);
    return item.offset_ms_auto;
  }

  function drawWaveform() {
    const canvas = els.waveformCanvas;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#d7dee6";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const waveform = state.waveform;
    if (waveform && waveform.peaks.length) {
      ctx.strokeStyle = "#245d91";
      ctx.lineWidth = Math.max(1, ratio);
      const step = width / waveform.peaks.length;
      waveform.peaks.forEach((peak, index) => {
        const x = index * step;
        const y = peak * (height * 0.42);
        ctx.beginPath();
        ctx.moveTo(x, height / 2 - y);
        ctx.lineTo(x, height / 2 + y);
        ctx.stroke();
      });
    } else {
      ctx.fillStyle = "#7a8795";
      ctx.font = `${13 * ratio}px sans-serif`;
      ctx.fillText("Waveform preview", 16 * ratio, 28 * ratio);
    }

    const item = currentItem();
    if (!item) return;
    const score = scoreFor(item);
    const durationMs = ((state.currentAudio && Number.isFinite(state.currentAudio.duration))
      ? state.currentAudio.duration
      : (waveform ? waveform.duration : 0)) * 1000;
    if (!durationMs) return;

    drawMarker(ctx, item.reference_ms, durationMs, width, height, "#2d8b57", "ref");
    drawMarker(ctx, markerOnsetMs(item, score), durationMs, width, height, "#d14646", "onset");
    drawMarker(ctx, markerOffsetMs(item, score), durationMs, width, height, "#b7791f", "offset");

    if (state.currentAudio) {
      drawMarker(ctx, state.currentAudio.currentTime * 1000, durationMs, width, height, "#1f6feb", "");
    }
  }

  function drawMarker(ctx, ms, durationMs, width, height, color, label) {
    const numericMs = Number(ms);
    if (ms == null || !Number.isFinite(numericMs) || durationMs <= 0 || numericMs < 0 || numericMs > durationMs) return;
    const x = (numericMs / durationMs) * width;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (label) {
      ctx.fillStyle = color;
      ctx.font = `${11 * (window.devicePixelRatio || 1)}px sans-serif`;
      ctx.fillText(label, x + 4, 14 * (window.devicePixelRatio || 1));
    }
  }

  function updateAudioTime() {
    const audio = state.currentAudio;
    if (!audio || !Number.isFinite(audio.duration)) {
      els.audioTime.textContent = "0.000s / 0.000s";
      return;
    }
    els.audioTime.textContent = `${audio.currentTime.toFixed(3)}s / ${audio.duration.toFixed(3)}s`;
  }

  async function playAudio() {
    const item = currentItem();
    const audio = state.currentAudio;
    if (!audio || !state.audioReady) return;
    audio.playbackRate = Number.parseFloat(els.speedSelect.value) || 1;
    if (audio.paused) {
      if (audio.ended || audio.currentTime >= Math.max(0, audio.duration - 0.02)) {
        audio.currentTime = 0;
      }
      await audio.play();
      recordAudioPlayback(item);
      els.playBtn.textContent = "Pause";
      animateWaveform();
    } else {
      audio.pause();
      els.playBtn.textContent = "Play";
    }
  }

  function animateWaveform() {
    if (state.animationId) cancelAnimationFrame(state.animationId);
    const tick = () => {
      drawWaveform();
      if (state.currentAudio && !state.currentAudio.paused) {
        state.animationId = requestAnimationFrame(tick);
      }
    };
    state.animationId = requestAnimationFrame(tick);
  }

  function stopAudio() {
    if (!state.currentAudio || !state.audioReady) return;
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    els.playBtn.textContent = "Play";
    updateAudioTime();
    drawWaveform();
  }

  function playFromOnset() {
    const item = currentItem();
    const audio = state.currentAudio;
    if (!item || !audio || !state.audioReady) return;
    const onsetMs = markerOnsetMs(item, scoreFor(item));
    if (onsetMs == null) return;
    audio.currentTime = Math.max(0, Number(onsetMs) / 1000 - 0.2);
    audio.play().then(() => {
      recordAudioPlayback(item);
      els.playBtn.textContent = "Pause";
      animateWaveform();
    });
  }

  function setAccuracy(scoreValue) {
    const item = currentItem();
    if (!item) return;
    const score = scoreFor(item);
    const patch = { accuracy_score: scoreValue };
    if (scoreValue === "NR") {
      patch.onset_status = "no_speech";
      patch.onset_ms_rater = null;
      patch.offset_status = "";
      patch.offset_ms_rater = null;
      els.onsetInput.value = "";
      els.offsetInput.value = "";
      setMarkerMode(null);
    } else if (score.onset_status === "no_speech") {
      patch.onset_status = "";
      patch.onset_ms_rater = null;
      patch.offset_status = "";
      patch.offset_ms_rater = null;
      els.onsetInput.value = item.onset_ms_auto != null ? item.onset_ms_auto.toFixed(1) : "";
      els.offsetInput.value = item.offset_ms_auto != null ? item.offset_ms_auto.toFixed(1) : "";
      setMarkerMode(null);
    }
    patchScore(item, patch);
    updateActiveButtons();
    updateTrialChecks();
    drawWaveform();
  }

  function setOnsetStatus(status) {
    const item = currentItem();
    if (!item) return;
    const patch = { onset_status: status };
    setMarkerMode(status === "manual" || status === "corrected" ? "onset" : null);
    if (status === "confirmed") {
      const score = scoreFor(item);
      const ms = score.onset_ms_rater != null ? score.onset_ms_rater : item.onset_ms_auto;
      if (ms != null) {
        patch.onset_ms_rater = Number(ms);
        els.onsetInput.value = Number(ms).toFixed(1);
      }
    }
    if (status === "no_speech") {
      patch.onset_ms_rater = null;
      patch.offset_status = "";
      patch.offset_ms_rater = null;
      els.onsetInput.value = "";
      els.offsetInput.value = "";
    }
    patchScore(item, patch);
    updateActiveButtons();
    updateTrialChecks();
    drawWaveform();
  }

  function applyManualOnset(ms, status = "manual") {
    const item = currentItem();
    if (!item || ms == null || !Number.isFinite(Number(ms))) return;
    patchScore(item, {
      onset_status: status,
      onset_ms_rater: Number(ms),
    });
    const score = scoreFor(item);
    if (score.offset_ms_rater != null && Number(score.offset_ms_rater) < Number(ms)) {
      patchScore(item, { offset_ms_rater: Number(ms), offset_status: score.offset_status || "manual" });
      els.offsetInput.value = Number(ms).toFixed(1);
    }
    setMarkerMode(status === "manual" || status === "corrected" ? "onset" : null);
    els.onsetInput.value = Number(ms).toFixed(1);
    updateActiveButtons();
    updateTrialChecks();
    drawWaveform();
  }

  function applyManualOffset(ms, status = "manual") {
    const item = currentItem();
    if (!item || ms == null || !Number.isFinite(Number(ms))) return;
    const score = scoreFor(item);
    const onsetMs = markerOnsetMs(item, score);
    const boundedMs = onsetMs != null ? Math.max(Number(onsetMs), Number(ms)) : Number(ms);
    patchScore(item, {
      offset_status: status,
      offset_ms_rater: boundedMs,
    });
    els.offsetInput.value = boundedMs.toFixed(1);
    updateActiveButtons();
    updateTrialChecks();
    drawWaveform();
  }

  function clearOffset() {
    const item = currentItem();
    if (!item) return;
    patchScore(item, {
      offset_status: "cleared",
      offset_ms_rater: null,
    });
    els.offsetInput.value = "";
    if (state.markerMode === "offset") setMarkerMode(null);
    updateTrialChecks();
    drawWaveform();
  }

  function canvasToMs(event) {
    const item = currentItem();
    const audio = state.currentAudio;
    if (!item || !audio || !Number.isFinite(audio.duration)) return null;
    const rect = els.waveformCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    return (x / rect.width) * audio.duration * 1000;
  }

  function markerNearPointer(event) {
    const item = currentItem();
    const audio = state.currentAudio;
    if (!item || !audio || !Number.isFinite(audio.duration)) return null;
    const rect = els.waveformCanvas.getBoundingClientRect();
    const durationMs = audio.duration * 1000;
    const score = scoreFor(item);
    const candidates = [
      ["onset", markerOnsetMs(item, score)],
      ["offset", markerOffsetMs(item, score)],
    ].filter(([, ms]) => ms != null && Number.isFinite(Number(ms)));
    let nearest = null;
    candidates.forEach(([marker, ms]) => {
      const x = rect.left + (Number(ms) / durationMs) * rect.width;
      const distance = Math.abs(event.clientX - x);
      if (distance <= 12 && (!nearest || distance < nearest.distance)) {
        nearest = { marker, distance };
      }
    });
    return nearest ? nearest.marker : null;
  }

  function applyMarkerAtEvent(marker, event) {
    const ms = canvasToMs(event);
    if (ms == null) return;
    if (marker === "offset") {
      applyManualOffset(ms);
    } else {
      const currentStatus = scoreFor(currentItem()).onset_status;
      applyManualOnset(ms, currentStatus === "manual" ? "manual" : "corrected");
    }
  }

  function startMarkerDrag(event) {
    if (!state.audioReady) return;
    const marker = state.markerMode || markerNearPointer(event);
    if (!marker) return;
    event.preventDefault();
    state.draggingMarker = marker;
    els.waveformCanvas.classList.add("marker-dragging");
    els.waveformCanvas.setPointerCapture?.(event.pointerId);
    applyMarkerAtEvent(marker, event);
  }

  function continueMarkerDrag(event) {
    if (!state.draggingMarker) return;
    event.preventDefault();
    applyMarkerAtEvent(state.draggingMarker, event);
  }

  function endMarkerDrag(event) {
    if (!state.draggingMarker) return;
    els.waveformCanvas.releasePointerCapture?.(event.pointerId);
    state.draggingMarker = null;
    els.waveformCanvas.classList.remove("marker-dragging");
  }

  function updateNotes() {
    const item = currentItem();
    if (!item) return;
    patchScore(item, { notes: els.notesInput.value });
    updateTrialChecks();
  }

  function nextItem() {
    if (state.currentIndex < state.items.length - 1) {
      showItem(state.currentIndex + 1);
    }
  }

  function prevItem() {
    if (state.currentIndex > 0) {
      showItem(state.currentIndex - 1);
    }
  }

  function scoredCount() {
    return state.items.filter(isComplete).length;
  }

  function nextOpenItem() {
    if (!state.items.length) return;
    for (let offset = 1; offset <= state.items.length; offset += 1) {
      const index = (state.currentIndex + offset) % state.items.length;
      if (!isComplete(state.items[index])) {
        showItem(index);
        return;
      }
    }
  }

  function renderTrialStrip() {
    els.trialStrip.innerHTML = "";
    if (!state.items.length) return;
    state.items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.className = "trial-dot";
      button.dataset.state = isComplete(item) ? "complete" : (hasPartialScore(item) ? "partial" : "open");
      button.classList.toggle("active", index === state.currentIndex);
      button.setAttribute("aria-current", index === state.currentIndex ? "step" : "false");
      button.setAttribute("aria-label", `${index + 1}: ${completionLabel(item)}`);
      button.addEventListener("click", () => showItem(index));
      els.trialStrip.append(button);
    });
  }

  function updateProgress() {
    const done = scoredCount();
    const total = state.items.length;
    const pct = total ? (done / total) * 100 : 0;
    els.progressFill.style.width = `${pct}%`;
    els.progressText.textContent = `${done} of ${total} complete`;
    els.railSaved.textContent = String(done);
    els.prevBtn.disabled = state.currentIndex === 0;
    els.nextBtn.disabled = state.currentIndex >= state.items.length - 1;
    els.nextUnscoredBtn.disabled = total === 0 || done === total;
    els.exportCsvBtn.disabled = total === 0;
    els.exportJsonBtn.disabled = total === 0;
    renderTrialStrip();
  }

  function buildExportRows() {
    const raterId = els.raterId.value.trim();
    const sessionId = sessionIdValue();
    return state.items.map((item) => {
      const score = scoreFor(item);
      const onsetMs = score.accuracy_score === "NR" ? null : score.onset_ms_rater;
      const offsetMs = score.accuracy_score === "NR" ? null : score.offset_ms_rater;
      const latencyRater = onsetMs != null && item.reference_ms != null
        ? Number(onsetMs) - Number(item.reference_ms)
        : "";
      const durationRater = onsetMs != null && offsetMs != null
        ? Number(offsetMs) - Number(onsetMs)
        : "";
      return {
        platform_version: VERSION,
        rater_id: raterId,
        session_id: sessionId,
        manifest_url: state.manifestUrl,
        dataset_id: item.dataset_id,
        test_session: item.test_session,
        scored_at: score.scored_at || "",
        row_index: item.row_index,
        participant_id: item.participant_id,
        task: item.task,
        trial_number: item.trial_number,
        target_word: item.target_word,
        expected_response: item.expected_response,
        expected_language: item.expected_language,
        audio_url: item.audio_url,
        source_path: item.source_path,
        audio_play_count: score.audio_play_count || "",
        image_url: item.image_url,
        condition: item.condition,
        accent_condition: item.accent_condition,
        list: item.list,
        word_number: item.word_number,
        accuracy_score: score.accuracy_score != null ? score.accuracy_score : "",
        onset_status: score.onset_status || "",
        onset_ms_auto: item.onset_ms_auto != null ? item.onset_ms_auto : "",
        onset_ms_rater: onsetMs != null ? Number(onsetMs).toFixed(1) : "",
        offset_status: score.offset_status || "",
        offset_ms_auto: item.offset_ms_auto != null ? item.offset_ms_auto : "",
        offset_ms_rater: offsetMs != null ? Number(offsetMs).toFixed(1) : "",
        duration_ms_rater: durationRater !== "" && Number.isFinite(durationRater) ? durationRater.toFixed(1) : "",
        reference_ms: item.reference_ms != null ? item.reference_ms : "",
        latency_ms_auto: item.latency_ms_auto != null ? item.latency_ms_auto : "",
        latency_ms_rater: latencyRater !== "" ? latencyRater.toFixed(1) : "",
        notes: score.notes || "",
      };
    });
  }

  function downloadBlob(content, fileName, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    downloadBlob(rowsToCsv(buildExportRows()), `${exportBaseName()}.csv`, "text/csv;charset=utf-8");
  }

  function exportJson() {
    downloadBlob(JSON.stringify({
      platform_version: VERSION,
      exported_at: new Date().toISOString(),
      rater_id: els.raterId.value.trim(),
      session_id: sessionIdValue(),
      manifest_url: state.manifestUrl,
      task_filter: selectedTaskKey(),
      assigned_participants: state.assignedParticipants,
      rows: buildExportRows(),
    }, null, 2), `${exportBaseName()}.json`, "application/json;charset=utf-8");
  }

  window.addEventListener("resize", drawWaveform);

  els.versionLabel.textContent = VERSION;
  els.loadManifestBtn.addEventListener("click", () => {
    loadManifest().catch((error) => {
      els.loadManifestBtn.disabled = false;
      setSetupStatus("Load failed");
      setLog(`Manifest load failed: ${error.message}`);
    });
  });
  els.customManifestToggle.addEventListener("change", syncCustomManifestVisibility);
  els.manifestUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadManifest().catch((error) => {
        els.loadManifestBtn.disabled = false;
        setSetupStatus("Load failed");
        setLog(`Manifest load failed: ${error.message}`);
      });
    }
  });
  els.testSelect.addEventListener("change", () => {
    clearPreparedQueue();
    renderParticipants();
  });
  els.raterId.addEventListener("input", () => {
    clearPreparedQueue();
    updateSetupSummary();
  });
  els.selectAllBtn.addEventListener("click", () => {
    clearPreparedQueue();
    els.participantGrid.querySelectorAll("input").forEach((input) => {
      input.checked = true;
    });
    updateSetupSummary();
  });
  els.clearAllBtn.addEventListener("click", () => {
    clearPreparedQueue();
    els.participantGrid.querySelectorAll("input").forEach((input) => {
      input.checked = false;
    });
    updateSetupSummary();
  });
  els.prepareBtn.addEventListener("click", prepareScoring);
  els.startBtn.addEventListener("click", startScoring);
  els.backBtn.addEventListener("click", showSetup);
  els.prevBtn.addEventListener("click", prevItem);
  els.nextUnscoredBtn.addEventListener("click", nextOpenItem);
  els.nextBtn.addEventListener("click", nextItem);
  els.playBtn.addEventListener("click", () => playAudio().catch(() => {
    els.audioStatus.textContent = "Playback failed.";
  }));
  els.stopBtn.addEventListener("click", stopAudio);
  els.playOnsetBtn.addEventListener("click", playFromOnset);
  els.speedSelect.addEventListener("change", () => {
    if (state.currentAudio) state.currentAudio.playbackRate = Number.parseFloat(els.speedSelect.value) || 1;
  });
  els.scoreButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".score-button");
    if (button) setAccuracy(button.dataset.score);
  });
  els.onsetButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".onset-button");
    if (button) setOnsetStatus(button.dataset.onset);
  });
  els.applyOnsetBtn.addEventListener("click", () => {
    const item = currentItem();
    const score = scoreFor(item);
    const onsetValue = Number.parseFloat(els.onsetInput.value);
    const offsetValue = Number.parseFloat(els.offsetInput.value);
    const currentOnset = markerOnsetMs(item, score);
    const currentOffset = markerOffsetMs(item, score);
    const onsetChanged = Number.isFinite(onsetValue) && (
      currentOnset == null ||
      Math.abs(onsetValue - Number(currentOnset)) >= 0.05 ||
      !score.onset_status
    );
    const offsetChanged = Number.isFinite(offsetValue) && (
      currentOffset == null ||
      Math.abs(offsetValue - Number(currentOffset)) >= 0.05
    );
    if (onsetChanged) applyManualOnset(onsetValue);
    if (offsetChanged) applyManualOffset(offsetValue);
  });
  els.setOnsetMarkerBtn.addEventListener("click", () => setMarkerMode(state.markerMode === "onset" ? null : "onset"));
  els.setOffsetMarkerBtn.addEventListener("click", () => setMarkerMode(state.markerMode === "offset" ? null : "offset"));
  els.clearOffsetBtn.addEventListener("click", clearOffset);
  els.waveformCanvas.addEventListener("pointerdown", startMarkerDrag);
  els.waveformCanvas.addEventListener("pointermove", continueMarkerDrag);
  els.waveformCanvas.addEventListener("pointerup", endMarkerDrag);
  els.waveformCanvas.addEventListener("pointercancel", endMarkerDrag);
  els.notesInput.addEventListener("input", updateNotes);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportJsonBtn.addEventListener("click", exportJson);

  syncCustomManifestVisibility();
  loadManifest().catch((error) => {
    els.loadManifestBtn.disabled = false;
    setSetupStatus("Load failed");
    setLog(`Manifest load failed: ${error.message}`);
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (els.scoringPanel.classList.contains("hidden")) return;
    if (event.key === " ") {
      event.preventDefault();
      playAudio().catch(() => {});
    } else if (event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault();
      nextItem();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevItem();
    } else if (event.key === "9") {
      setAccuracy("NR");
    } else if (event.key === "0") {
      setAccuracy("0");
    } else if (event.key === "5") {
      setAccuracy("0.5");
    } else if (event.key === "1") {
      setAccuracy("1");
    } else if (event.key.toLowerCase() === "c") {
      setOnsetStatus("confirmed");
    } else if (event.key.toLowerCase() === "r") {
      playFromOnset();
    }
  });

  updateSetupSummary();
})();
