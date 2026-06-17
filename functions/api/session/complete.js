import {
  cleanText,
  errorResponse,
  insertEvent,
  jsonResponse,
  nowIso,
  readJson,
  requireDb,
} from "../_utils.js";

export async function onRequestPost(context) {
  try {
    const db = requireDb(context.env);
    const body = await readJson(context.request);
    const sessionId = cleanText(body.session_id || body.server_session_id);
    if (!sessionId) return errorResponse("session_id is required.");

    const session = await db
      .prepare(
        `SELECT id, rater_id, trial_count, counterbalance_allocation_id
         FROM sessions WHERE id = ?`,
      )
      .bind(sessionId)
      .first();
    if (!session) return errorResponse("Session was not found.", 404);

    const countRow = await db
      .prepare("SELECT COUNT(*) AS count FROM rating_trials WHERE session_id = ?")
      .bind(sessionId)
      .first();
    const completedCount = Number(countRow?.count || 0);
    const completedAt = nowIso();
    const status =
      completedCount >= Number(session.trial_count || 0)
        ? "completed"
        : "completed_with_missing_trials";

    await db
      .prepare(
        `UPDATE sessions
         SET status = ?, completed_at = ?, last_seen_at = ?,
             completed_trial_count = ?
         WHERE id = ?`,
      )
      .bind(status, completedAt, completedAt, completedCount, sessionId)
      .run();

    if (session.counterbalance_allocation_id) {
      await db
        .prepare(
          `UPDATE counterbalance_allocations
           SET status = ?, completed_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          status === "completed" ? "completed" : "incomplete",
          status === "completed" ? completedAt : null,
          completedAt,
          session.counterbalance_allocation_id,
        )
        .run();
    }

    await insertEvent(db, {
      session_id: sessionId,
      rater_id: session.rater_id,
      event_type: "session_complete",
      event_at: completedAt,
      payload: {
        trial_count: session.trial_count,
        completed_trial_count: completedCount,
        status,
      },
    });

    return jsonResponse({
      ok: true,
      session_id: sessionId,
      status,
      trial_count: Number(session.trial_count || 0),
      completed_trial_count: completedCount,
    });
  } catch (error) {
    return errorResponse(error.message || "Could not complete session.", error.status || 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "OPTIONS") return jsonResponse({ ok: true });
  return errorResponse("Method not allowed.", 405);
}
