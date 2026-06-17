import {
  cleanText,
  errorResponse,
  insertEvent,
  jsonResponse,
  nowIso,
  nullableInt,
  nullableText,
  readJson,
  requireDb,
  requestClientContext,
  safeJson,
} from "../_utils.js";
import {
  allocateCounterbalance,
  buildCounterbalancedAssignment,
  counterbalancePayload,
  loadCounterbalanceMaterials,
  safeMaterialsJson,
} from "../_counterbalance.js";

const ASSIGNMENT_SELECT = `
  SELECT
    phase, trial_index, source_path, audio_url, file_name, target_word,
    participant_id, native_language, accent_condition, condition, talker,
    pass_number, word_number, trial_number, take_number, spoken_form,
    practice_note, source_format, practice_kind, practice_group,
    counterbalance_cell, list_comb, pronunciation_style, stimulus_list,
    l1_condition, pronunciation_condition, expert_comprehensibility_1_9,
    expert_accentedness_1_9
  FROM rating_assignments
  WHERE session_id = ? AND phase = ?
  ORDER BY trial_index
`;

function isUniqueConstraintError(error) {
  return /UNIQUE constraint failed/i.test(String(error?.message || error));
}

function hasProlificIdentity(client) {
  return Boolean(
    client.prolific_session_id ||
      (client.prolific_pid && client.prolific_study_id),
  );
}

async function findExistingProlificSession(db, client) {
  if (client.prolific_session_id) {
    return db
      .prepare(
        `SELECT * FROM sessions
         WHERE prolific_session_id = ? AND status != 'start_failed'
         ORDER BY started_at
         LIMIT 1`,
      )
      .bind(client.prolific_session_id)
      .first();
  }
  if (client.prolific_pid && client.prolific_study_id) {
    return db
      .prepare(
        `SELECT * FROM sessions
         WHERE prolific_pid = ? AND prolific_study_id = ? AND status != 'start_failed'
         ORDER BY started_at
         LIMIT 1`,
      )
      .bind(client.prolific_pid, client.prolific_study_id)
      .first();
  }
  return null;
}

function counterbalanceFromSession(session) {
  if (!session?.counterbalance_cell) return null;
  return {
    allocation_id: nullableText(session.counterbalance_allocation_id),
    cell_id: nullableInt(session.counterbalance_cell),
    list_comb: session.list_comb,
    pronunciation_style: session.pronunciation_style,
  };
}

async function existingSessionResponse(db, session) {
  const { results } = await db
    .prepare(ASSIGNMENT_SELECT)
    .bind(session.id, "main")
    .all();
  return {
    ok: true,
    existing_session: true,
    session_id: session.id,
    status: session.status,
    completed_trial_count: Number(session.completed_trial_count || 0),
    trial_count: Number(session.trial_count || 0),
    counterbalance: counterbalancePayload(counterbalanceFromSession(session)),
    main_assignment: results || [],
  };
}

async function cleanupFailedStart(db, sessionId, allocationId) {
  const statements = [
    db.prepare("DELETE FROM rating_assignments WHERE session_id = ?").bind(sessionId),
    db.prepare("DELETE FROM sessions WHERE id = ? AND status = 'started'").bind(sessionId),
  ];
  if (allocationId) {
    statements.push(
      db
        .prepare("DELETE FROM counterbalance_allocations WHERE id = ? AND status = 'started'")
        .bind(allocationId),
    );
  }
  await db.batch(statements);
}

async function insertEventBestEffort(db, event) {
  try {
    await insertEvent(db, event);
  } catch (error) {
    console.warn("event log failed", error);
  }
}

export async function onRequestPost(context) {
  let db = null;
  let sessionId = "";
  let counterbalance = null;
  let client = null;
  try {
    db = requireDb(context.env);
    const body = await readJson(context.request);
    const raterId = cleanText(body.rater_id);
    const sessionLabel = cleanText(body.session_label);
    const taskMode = cleanText(body.task_mode) || "combined";
    const platformVersion = cleanText(body.platform_version) || "unknown";
    const counterbalanceEnabled = body.counterbalance?.enabled === true;
    const practiceAssignment = Array.isArray(body.practice_assignment)
      ? body.practice_assignment
      : [];
    let assignment = Array.isArray(body.assignment) ? body.assignment : [];
    let mainAssignment = [];

    if (!raterId) return errorResponse("rater_id is required.");
    if (!sessionLabel) return errorResponse("session_label is required.");

    client = requestClientContext(context.request, body);
    if (hasProlificIdentity(client)) {
      const existing = await findExistingProlificSession(db, client);
      if (existing) return jsonResponse(await existingSessionResponse(db, existing));
    }

    sessionId = crypto.randomUUID();
    const startedAt = nowIso();
    const screenJson = safeJson(body.screen || {});
    const seed = cleanText(body.seed) || `${raterId}_${sessionLabel}_${platformVersion}`;
    let manifestSummary = null;

    if (counterbalanceEnabled) {
      const loadedManifest = await loadCounterbalanceMaterials(context);
      manifestSummary = loadedManifest.summary;
      counterbalance = await allocateCounterbalance(db, sessionId, startedAt);
      try {
        mainAssignment = buildCounterbalancedAssignment(
          loadedManifest.materials,
          counterbalance,
          `${seed}:${sessionId}`,
        );
      } catch (error) {
        await db
          .prepare("DELETE FROM counterbalance_allocations WHERE id = ?")
          .bind(counterbalance.allocation_id)
          .run();
        throw error;
      }
      assignment = [...practiceAssignment, ...mainAssignment];
    }

    if (!assignment.length) return errorResponse("assignment must contain trials.");

    try {
      await db
        .prepare(
          `INSERT INTO sessions (
            id, role, rater_id, session_label, task_mode, platform_version,
            prolific_pid, prolific_study_id, prolific_session_id, seed,
            user_agent, timezone, japanese_familiarity_1_6,
            chinese_familiarity_1_6, completion_code,
            counterbalance_allocation_id, counterbalance_cell, list_comb,
            pronunciation_style, screen_json,
            started_at, last_seen_at,
            status, trial_count, completed_trial_count
          ) VALUES (?, 'rater', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'started', ?, 0)`,
        )
        .bind(
          sessionId,
          raterId,
          sessionLabel,
          taskMode,
          platformVersion,
          nullableText(client.prolific_pid),
          nullableText(client.prolific_study_id),
          nullableText(client.prolific_session_id),
          nullableText(seed),
          nullableText(client.user_agent),
          nullableText(body.timezone),
          nullableInt(body.japanese_familiarity_1_6),
          nullableInt(body.chinese_familiarity_1_6),
          nullableText(body.completion_code),
          nullableText(counterbalance?.allocation_id),
          nullableInt(counterbalance?.cell_id),
          nullableText(counterbalance?.list_comb),
          nullableText(counterbalance?.pronunciation_style),
          screenJson,
          startedAt,
          startedAt,
          assignment.length,
        )
        .run();

      const statements = assignment.map((item, index) => {
        const trialIndex = Number.parseInt(item.trial_index || index + 1, 10);
        const phase = cleanText(item.phase) || "main";
        return db
          .prepare(
            `INSERT INTO rating_assignments (
              id, session_id, phase, trial_index, source_path, audio_url, file_name,
              target_word, participant_id, native_language, accent_condition,
              condition, talker, pass_number, word_number, trial_number,
              take_number, spoken_form, practice_note, source_format,
              practice_kind, practice_group, counterbalance_cell, list_comb,
              pronunciation_style, stimulus_list, l1_condition,
              pronunciation_condition, expert_comprehensibility_1_9,
              expert_accentedness_1_9, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            `${sessionId}:${phase}:${trialIndex}`,
            sessionId,
            phase,
            trialIndex,
            nullableText(item.source_path),
            nullableText(item.audio_url),
            nullableText(item.file_name),
            nullableText(item.target_word),
            nullableText(item.participant_id),
            nullableText(item.native_language),
            nullableText(item.accent_condition),
            nullableText(item.condition),
            nullableText(item.talker),
            nullableText(item.pass_number),
            nullableText(item.word_number),
            nullableText(item.trial_number),
            nullableText(item.take_number),
            nullableText(item.spoken_form),
            nullableText(item.practice_note),
            nullableText(item.source_format),
            nullableText(item.practice_kind),
            nullableText(item.practice_group),
            nullableInt(item.counterbalance_cell),
            nullableText(item.list_comb),
            nullableText(item.pronunciation_style),
            nullableText(item.stimulus_list),
            nullableText(item.l1_condition),
            nullableText(item.pronunciation_condition),
            nullableInt(item.expert_comprehensibility_1_9),
            nullableInt(item.expert_accentedness_1_9),
            startedAt,
          );
      });

      await db.batch(statements);
    } catch (error) {
      await cleanupFailedStart(db, sessionId, counterbalance?.allocation_id);
      if (isUniqueConstraintError(error) && hasProlificIdentity(client)) {
        const existing = await findExistingProlificSession(db, client);
        if (existing) return jsonResponse(await existingSessionResponse(db, existing));
      }
      throw error;
    }

    await insertEventBestEffort(db, {
      session_id: sessionId,
      rater_id: raterId,
      event_type: "session_start",
      event_at: startedAt,
      payload: {
        task_mode: taskMode,
        platform_version: platformVersion,
        trial_count: assignment.length,
        seed: cleanText(body.seed),
        japanese_familiarity_1_6: body.japanese_familiarity_1_6,
        chinese_familiarity_1_6: body.chinese_familiarity_1_6,
        counterbalance: counterbalancePayload(counterbalance),
        counterbalance_enabled: counterbalanceEnabled,
        materials: counterbalanceEnabled ? JSON.parse(safeMaterialsJson(manifestSummary)) : undefined,
      },
    });

    return jsonResponse({
      ok: true,
      session_id: sessionId,
      trial_count: assignment.length,
      counterbalance: counterbalancePayload(counterbalance),
      main_assignment: mainAssignment,
    });
  } catch (error) {
    return errorResponse(error.message || "Could not start session.", error.status || 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "OPTIONS") return jsonResponse({ ok: true });
  return errorResponse("Method not allowed.", 405);
}
