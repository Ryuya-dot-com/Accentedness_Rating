import {
  boolToInt,
  cleanText,
  errorResponse,
  insertEvent,
  jsonResponse,
  nowIso,
  nullableInt,
  nullableNumber,
  nullableText,
  readJson,
  requireDb,
  requestClientContext,
  safeJson,
} from "./_utils.js";

function normalizeResponse(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value) !== "";
}

export async function onRequestPost(context) {
  try {
    const db = requireDb(context.env);
    const body = await readJson(context.request);
    const serverSessionId = cleanText(body.session_id || body.server_session_id);
    const row = body.row || {};
    const phase = cleanText(row.phase) || "main";
    const trialIndex = nullableInt(row.trial_index);

    if (!serverSessionId) return errorResponse("server session_id is required.");
    if (!trialIndex) return errorResponse("row.trial_index is required.");

    const session = await db
      .prepare(
        `SELECT id, rater_id, session_label, task_mode, platform_version,
          prolific_pid, prolific_study_id, prolific_session_id, trial_count
         FROM sessions WHERE id = ?`,
      )
      .bind(serverSessionId)
      .first();
    if (!session) return errorResponse("Session was not found.", 404);

    const assignment = await db
      .prepare(
        `SELECT *
         FROM rating_assignments
         WHERE session_id = ? AND phase = ? AND trial_index = ?`,
      )
      .bind(serverSessionId, phase, trialIndex)
      .first();
    if (!assignment) {
      return errorResponse("Assignment was not found for this session/trial.", 409);
    }

    const receivedAt = nowIso();
    const client = requestClientContext(context.request, body);
    const assignmentId = assignment.id;
    const trialId = assignmentId;
    const typedResponse = cleanText(row.typed_response);
    const normalizedResponse = normalizeResponse(typedResponse);
    const normalizedTarget = normalizeResponse(assignment.target_word);
    const shouldScoreIntelligibility = Boolean(
      normalizedTarget &&
        (hasValue(row.typed_response) ||
          hasValue(row.normalized_response) ||
          hasValue(row.intelligibility_exact)),
    );

    await db
      .prepare(
        `INSERT OR REPLACE INTO rating_trials (
          id, session_id, assignment_id, rater_id, session_label,
          prolific_pid, prolific_study_id, prolific_session_id, task_mode,
          platform_version, phase, practice_kind, practice_group,
          counterbalance_cell, list_comb, pronunciation_style, stimulus_list,
          l1_condition, pronunciation_condition,
          trial_index, trial_total, completed_at, played_at,
          source_path, audio_url, file_name, participant_id, native_language,
          accent_condition, condition, talker, pass_number, word_number,
          trial_number, take_number, spoken_form, practice_note, source_format,
          target_word, typed_response, normalized_response, normalized_target,
          intelligibility_exact, intelligibility_needs_manual_review,
          comprehensibility_1_9, accentedness_1_9,
          expert_comprehensibility_1_9, expert_accentedness_1_9,
          practice_feedback, practice_requires_reason, practice_reason,
          japanese_familiarity_1_6, chinese_familiarity_1_6,
          first_key_rt_ms, submit_rt_ms, audio_duration_s, replay_count,
          client_saved_at, server_received_at, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
      )
      .bind(
        trialId,
        serverSessionId,
        assignmentId,
        cleanText(session.rater_id),
        cleanText(session.session_label),
        nullableText(session.prolific_pid || client.prolific_pid),
        nullableText(session.prolific_study_id || client.prolific_study_id),
        nullableText(session.prolific_session_id || client.prolific_session_id),
        cleanText(session.task_mode || row.task_mode),
        cleanText(session.platform_version || row.platform_version),
        cleanText(assignment.phase),
        nullableText(assignment.practice_kind),
        nullableText(assignment.practice_group),
        nullableInt(assignment.counterbalance_cell),
        nullableText(assignment.list_comb),
        nullableText(assignment.pronunciation_style),
        nullableText(assignment.stimulus_list),
        nullableText(assignment.l1_condition),
        nullableText(assignment.pronunciation_condition),
        trialIndex,
        nullableInt(session.trial_count) || nullableInt(row.trial_total) || 0,
        nullableText(row.completed_at) || receivedAt,
        nullableText(row.played_at),
        nullableText(assignment.source_path),
        nullableText(assignment.audio_url),
        nullableText(assignment.file_name),
        nullableText(assignment.participant_id),
        nullableText(assignment.native_language),
        nullableText(assignment.accent_condition),
        nullableText(assignment.condition),
        nullableText(assignment.talker),
        nullableText(assignment.pass_number),
        nullableText(assignment.word_number),
        nullableText(assignment.trial_number),
        nullableText(assignment.take_number),
        nullableText(assignment.spoken_form),
        nullableText(assignment.practice_note),
        nullableText(assignment.source_format),
        nullableText(assignment.target_word),
        nullableText(typedResponse),
        nullableText(normalizedResponse),
        nullableText(normalizedTarget),
        shouldScoreIntelligibility
          ? Number(normalizedResponse === normalizedTarget)
          : boolToInt(row.intelligibility_exact),
        shouldScoreIntelligibility
          ? Number(normalizedResponse !== normalizedTarget)
          : boolToInt(row.intelligibility_needs_manual_review),
        nullableInt(row.comprehensibility_1_9),
        nullableInt(row.accentedness_1_9),
        nullableInt(assignment.expert_comprehensibility_1_9),
        nullableInt(assignment.expert_accentedness_1_9),
        nullableText(row.practice_feedback),
        boolToInt(row.practice_requires_reason),
        nullableText(row.practice_reason),
        nullableInt(row.japanese_familiarity_1_6),
        nullableInt(row.chinese_familiarity_1_6),
        nullableNumber(row.first_key_rt_ms),
        nullableNumber(row.submit_rt_ms),
        nullableNumber(row.audio_duration_s),
        nullableInt(row.replay_count) || 0,
        nullableText(row.completed_at) || receivedAt,
        receivedAt,
        safeJson(row),
      )
      .run();

    await db
      .prepare(
        `UPDATE sessions
         SET last_seen_at = ?,
             completed_trial_count = (
               SELECT COUNT(*) FROM rating_trials WHERE session_id = ?
             )
         WHERE id = ?`,
      )
      .bind(receivedAt, serverSessionId, serverSessionId)
      .run();

    await insertEvent(db, {
      session_id: serverSessionId,
      rater_id: cleanText(session.rater_id),
      event_type: "trial_saved",
      trial_index: trialIndex,
      event_at: receivedAt,
      payload: {
        phase: assignment.phase,
        practice_kind: assignment.practice_kind,
        file_name: assignment.file_name,
        target_word: assignment.target_word,
        submit_rt_ms: row.submit_rt_ms,
      },
    });

    return jsonResponse({ ok: true, session_id: serverSessionId, trial_index: trialIndex });
  } catch (error) {
    return errorResponse(error.message || "Could not save trial.", error.status || 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "OPTIONS") return jsonResponse({ ok: true });
  return errorResponse("Method not allowed.", 405);
}
