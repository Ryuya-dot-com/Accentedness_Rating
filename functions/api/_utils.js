export function nowIso() {
  return new Date().toISOString();
}

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function textResponse(text, status = 200, headers = {}) {
  return new Response(text, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

export function requireDb(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured.");
  }
  return env.DB;
}

export function requireAdmin(request, env) {
  const token = cleanText(env.ADMIN_TOKEN);
  if (!token) {
    const err = new Error("Admin authorization is not configured.");
    err.status = 500;
    throw err;
  }
  const received = cleanText(request.headers.get("x-admin-token"));
  if (received !== token) {
    const err = new Error("Admin authorization failed.");
    err.status = 401;
    throw err;
  }
}

export function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function nullableText(value) {
  const text = cleanText(value);
  return text || null;
}

export function nullableInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

export function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function boolToInt(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return null;
}

export function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows, columns) {
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) => columns.map((key) => csvCell(row[key])).join(","));
  return [header, ...body].join("\n");
}

export function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    return JSON.stringify({ serialization_error: String(error?.message || error) });
  }
}

export async function insertEvent(db, event) {
  const id = crypto.randomUUID();
  const receivedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO event_logs (
        id, session_id, rater_id, event_type, trial_index, event_at,
        server_received_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      nullableText(event.session_id),
      nullableText(event.rater_id),
      cleanText(event.event_type) || "event",
      nullableInt(event.trial_index),
      nullableText(event.event_at) || receivedAt,
      receivedAt,
      safeJson(event.payload || {}),
    )
    .run();
  return id;
}

export function requestClientContext(request, body = {}) {
  const url = new URL(request.url);
  return {
    prolific_pid:
      cleanText(body.prolific_pid) || cleanText(url.searchParams.get("PROLIFIC_PID")),
    prolific_study_id:
      cleanText(body.prolific_study_id) || cleanText(url.searchParams.get("STUDY_ID")),
    prolific_session_id:
      cleanText(body.prolific_session_id) ||
      cleanText(url.searchParams.get("SESSION_ID")),
    user_agent: request.headers.get("user-agent") || "",
  };
}
