import {
  cleanText,
  errorResponse,
  insertEvent,
  jsonResponse,
  readJson,
  requireDb,
} from "./_utils.js";

export async function onRequestPost(context) {
  try {
    const db = requireDb(context.env);
    const body = await readJson(context.request);
    const eventType = cleanText(body.event_type);
    if (!eventType) return errorResponse("event_type is required.");

    const id = await insertEvent(db, {
      session_id: body.session_id || body.server_session_id,
      rater_id: body.rater_id,
      event_type: eventType,
      trial_index: body.trial_index,
      event_at: body.event_at,
      payload: body.payload || {},
    });

    return jsonResponse({ ok: true, id });
  } catch (error) {
    return errorResponse(error.message || "Could not save event.", error.status || 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "OPTIONS") return jsonResponse({ ok: true });
  return errorResponse("Method not allowed.", 405);
}
