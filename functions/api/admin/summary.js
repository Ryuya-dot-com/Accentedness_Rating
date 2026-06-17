import { errorResponse, jsonResponse, requireAdmin, requireDb } from "../_utils.js";

export async function onRequestGet(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = requireDb(context.env);
    const [sessions, trials, assignments, events] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM sessions").first(),
      db.prepare("SELECT COUNT(*) AS count FROM rating_trials").first(),
      db.prepare("SELECT COUNT(*) AS count FROM rating_assignments").first(),
      db.prepare("SELECT COUNT(*) AS count FROM event_logs").first(),
    ]);

    const statusRows = await db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM sessions
         GROUP BY status
         ORDER BY status`,
      )
      .all();

    const counterbalanceRows = await db
      .prepare(
        `SELECT
          cc.cell_id,
          cc.list_comb,
          cc.pronunciation_style,
          SUM(CASE WHEN ca.status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN ca.status = 'started' THEN 1 ELSE 0 END) AS started,
          SUM(CASE WHEN ca.status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete,
          COUNT(ca.id) AS assigned
        FROM counterbalance_cells cc
        LEFT JOIN counterbalance_allocations ca ON ca.cell_id = cc.cell_id
        GROUP BY cc.cell_id, cc.list_comb, cc.pronunciation_style
        ORDER BY cc.cell_id`,
      )
      .all();

    return jsonResponse({
      ok: true,
      counts: {
        sessions: Number(sessions?.count || 0),
        rating_trials: Number(trials?.count || 0),
        rating_assignments: Number(assignments?.count || 0),
        event_logs: Number(events?.count || 0),
      },
      sessions_by_status: statusRows.results || [],
      counterbalance_by_cell: counterbalanceRows.results || [],
    });
  } catch (error) {
    return errorResponse(error.message || "Could not load admin summary.", error.status || 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "OPTIONS") return jsonResponse({ ok: true });
  return errorResponse("Method not allowed.", 405);
}
