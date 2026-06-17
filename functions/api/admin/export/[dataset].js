import {
  errorResponse,
  requireAdmin,
  requireDb,
  rowsToCsv,
  textResponse,
} from "../../_utils.js";

const EXPORTS = {
  ratings: {
    fileName: "rating_trials.csv",
    columns: [
      "session_id",
      "assignment_id",
      "rater_id",
      "session_label",
      "prolific_pid",
      "prolific_study_id",
      "prolific_session_id",
      "task_mode",
      "platform_version",
      "phase",
      "practice_kind",
      "practice_group",
      "counterbalance_cell",
      "list_comb",
      "pronunciation_style",
      "stimulus_list",
      "l1_condition",
      "pronunciation_condition",
      "trial_index",
      "trial_total",
      "completed_at",
      "played_at",
      "server_received_at",
      "source_path",
      "audio_url",
      "file_name",
      "participant_id",
      "native_language",
      "accent_condition",
      "condition",
      "talker",
      "pass_number",
      "word_number",
      "trial_number",
      "take_number",
      "spoken_form",
      "practice_note",
      "source_format",
      "target_word",
      "typed_response",
      "normalized_response",
      "normalized_target",
      "intelligibility_exact",
      "intelligibility_needs_manual_review",
      "comprehensibility_1_9",
      "accentedness_1_9",
      "expert_comprehensibility_1_9",
      "expert_accentedness_1_9",
      "practice_feedback",
      "practice_requires_reason",
      "practice_reason",
      "japanese_familiarity_1_6",
      "chinese_familiarity_1_6",
      "first_key_rt_ms",
      "submit_rt_ms",
      "audio_duration_s",
      "replay_count",
    ],
    sql: `SELECT
        session_id, assignment_id, rater_id, session_label, prolific_pid,
        prolific_study_id, prolific_session_id, task_mode, platform_version,
        phase, practice_kind, practice_group,
        counterbalance_cell, list_comb, pronunciation_style, stimulus_list,
        l1_condition, pronunciation_condition, trial_index, trial_total,
        completed_at, played_at, server_received_at,
        source_path, audio_url, file_name, participant_id, native_language,
        accent_condition, condition, talker, pass_number, word_number,
        trial_number, take_number, spoken_form, practice_note, source_format,
        target_word, typed_response, normalized_response, normalized_target,
        intelligibility_exact, intelligibility_needs_manual_review,
        comprehensibility_1_9, accentedness_1_9,
        expert_comprehensibility_1_9, expert_accentedness_1_9,
        practice_feedback, practice_requires_reason, practice_reason,
        japanese_familiarity_1_6, chinese_familiarity_1_6,
        first_key_rt_ms, submit_rt_ms, audio_duration_s, replay_count
      FROM rating_trials
      ORDER BY rater_id, session_label, phase, trial_index`,
  },
  sessions: {
    fileName: "sessions.csv",
    columns: [
      "id",
      "role",
      "rater_id",
      "session_label",
      "task_mode",
      "platform_version",
      "prolific_pid",
      "prolific_study_id",
      "prolific_session_id",
      "seed",
      "japanese_familiarity_1_6",
      "chinese_familiarity_1_6",
      "completion_code",
      "counterbalance_allocation_id",
      "counterbalance_cell",
      "list_comb",
      "pronunciation_style",
      "started_at",
      "completed_at",
      "last_seen_at",
      "status",
      "trial_count",
      "completed_trial_count",
      "timezone",
      "user_agent",
    ],
    sql: `SELECT
        id, role, rater_id, session_label, task_mode, platform_version,
        prolific_pid, prolific_study_id, prolific_session_id, seed,
        japanese_familiarity_1_6, chinese_familiarity_1_6, completion_code,
        counterbalance_allocation_id, counterbalance_cell, list_comb,
        pronunciation_style,
        started_at, completed_at, last_seen_at, status, trial_count,
        completed_trial_count, timezone, user_agent
      FROM sessions
      ORDER BY started_at`,
  },
  assignments: {
    fileName: "rating_assignments.csv",
    columns: [
      "session_id",
      "phase",
      "trial_index",
      "source_path",
      "audio_url",
      "file_name",
      "target_word",
      "participant_id",
      "native_language",
      "accent_condition",
      "condition",
      "talker",
      "pass_number",
      "word_number",
      "trial_number",
      "take_number",
      "spoken_form",
      "practice_note",
      "source_format",
      "practice_kind",
      "practice_group",
      "counterbalance_cell",
      "list_comb",
      "pronunciation_style",
      "stimulus_list",
      "l1_condition",
      "pronunciation_condition",
      "expert_comprehensibility_1_9",
      "expert_accentedness_1_9",
      "created_at",
    ],
    sql: `SELECT
        session_id, phase, trial_index, source_path, audio_url, file_name,
        target_word, participant_id, native_language, accent_condition,
        condition, talker, pass_number, word_number, trial_number,
        take_number, spoken_form, practice_note, source_format,
        practice_kind, practice_group, counterbalance_cell, list_comb,
        pronunciation_style, stimulus_list, l1_condition,
        pronunciation_condition, expert_comprehensibility_1_9,
        expert_accentedness_1_9, created_at
      FROM rating_assignments
      ORDER BY session_id, phase, trial_index`,
  },
  events: {
    fileName: "event_logs.csv",
    columns: [
      "id",
      "session_id",
      "rater_id",
      "event_type",
      "trial_index",
      "event_at",
      "server_received_at",
      "payload_json",
    ],
    sql: `SELECT
        id, session_id, rater_id, event_type, trial_index, event_at,
        server_received_at, payload_json
      FROM event_logs
      ORDER BY server_received_at`,
  },
  counterbalance: {
    fileName: "counterbalance_allocations.csv",
    columns: [
      "id",
      "session_id",
      "cell_id",
      "list_comb",
      "pronunciation_style",
      "status",
      "assigned_at",
      "completed_at",
      "updated_at",
      "rater_id",
      "prolific_pid",
    ],
    sql: `SELECT
        ca.id, ca.session_id, ca.cell_id, cc.list_comb, cc.pronunciation_style,
        ca.status, ca.assigned_at, ca.completed_at, ca.updated_at,
        s.rater_id, s.prolific_pid
      FROM counterbalance_allocations ca
      JOIN counterbalance_cells cc ON cc.cell_id = ca.cell_id
      LEFT JOIN sessions s ON s.id = ca.session_id
      ORDER BY ca.assigned_at`,
  },
};

export async function onRequestGet(context) {
  try {
    requireAdmin(context.request, context.env);
    const dataset = String(context.params.dataset || "")
      .replace(/\.csv$/i, "")
      .toLowerCase();
    const exportSpec = EXPORTS[dataset];
    if (!exportSpec) {
      return errorResponse(
        "Unknown export. Use ratings.csv, sessions.csv, assignments.csv, events.csv, or counterbalance.csv.",
        404,
      );
    }

    const db = requireDb(context.env);
    const { results } = await db.prepare(exportSpec.sql).all();
    const csv = "\uFEFF" + rowsToCsv(results || [], exportSpec.columns);
    return textResponse(csv, 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportSpec.fileName}"`,
    });
  } catch (error) {
    return errorResponse(error.message || "Could not export data.", error.status || 500);
  }
}

export function onRequest(context) {
  return errorResponse("Method not allowed.", 405);
}
