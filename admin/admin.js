(function () {
  "use strict";

  const els = {
    token: document.getElementById("admin-token"),
    status: document.getElementById("admin-status"),
    log: document.getElementById("admin-log"),
    refreshBtn: document.getElementById("refresh-btn"),
    ratingsBtn: document.getElementById("ratings-btn"),
    sessionsBtn: document.getElementById("sessions-btn"),
    assignmentsBtn: document.getElementById("assignments-btn"),
    eventsBtn: document.getElementById("events-btn"),
    counterbalanceBtn: document.getElementById("counterbalance-btn"),
    sessions: document.getElementById("count-sessions"),
    trials: document.getElementById("count-trials"),
    assignments: document.getElementById("count-assignments"),
    events: document.getElementById("count-events"),
  };

  function token() {
    return els.token.value.trim();
  }

  function headers() {
    const out = {};
    if (token()) out["x-admin-token"] = token();
    return out;
  }

  function setStatus(text, ready = false) {
    els.status.textContent = text;
    els.status.dataset.ready = ready ? "true" : "false";
  }

  function setLog(text) {
    els.log.textContent = text;
  }

  async function fetchAdmin(path) {
    const response = await fetch(path, {
      headers: headers(),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `${response.status} ${response.statusText}`);
    }
    return response;
  }

  async function refreshSummary() {
    localStorage.setItem("rating_admin_token", token());
    setStatus("Loading");
    const response = await fetchAdmin("/api/admin/summary");
    const data = await response.json();
    els.sessions.textContent = String(data.counts.sessions || 0);
    els.trials.textContent = String(data.counts.rating_trials || 0);
    els.assignments.textContent = String(data.counts.rating_assignments || 0);
    els.events.textContent = String(data.counts.event_logs || 0);
    setStatus("Loaded", true);
    setLog(
      [
        "sessions_by_status:",
        ...(data.sessions_by_status || []).map(
          (row) => `${row.status || "(blank)"}: ${row.count}`,
        ),
        "",
        "counterbalance_by_cell:",
        ...(data.counterbalance_by_cell || []).map(
          (row) =>
            `cell ${row.cell_id} ${row.list_comb}/${row.pronunciation_style}: ` +
            `completed=${row.completed || 0}, started=${row.started || 0}, ` +
            `incomplete=${row.incomplete || 0}, assigned=${row.assigned || 0}`,
        ),
      ].join("\n"),
    );
  }

  async function downloadCsv(dataset) {
    localStorage.setItem("rating_admin_token", token());
    setStatus("Downloading");
    const response = await fetchAdmin(`/api/admin/export/${dataset}.csv`);
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match ? match[1] : `${dataset}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus("Downloaded", true);
  }

  els.token.value = localStorage.getItem("rating_admin_token") || "";
  els.refreshBtn.addEventListener("click", () => {
    refreshSummary().catch((error) => {
      setStatus("Failed");
      setLog(error.message);
    });
  });
  els.ratingsBtn.addEventListener("click", () => {
    downloadCsv("ratings").catch((error) => {
      setStatus("Failed");
      setLog(error.message);
    });
  });
  els.sessionsBtn.addEventListener("click", () => {
    downloadCsv("sessions").catch((error) => {
      setStatus("Failed");
      setLog(error.message);
    });
  });
  els.assignmentsBtn.addEventListener("click", () => {
    downloadCsv("assignments").catch((error) => {
      setStatus("Failed");
      setLog(error.message);
    });
  });
  els.eventsBtn.addEventListener("click", () => {
    downloadCsv("events").catch((error) => {
      setStatus("Failed");
      setLog(error.message);
    });
  });
  els.counterbalanceBtn.addEventListener("click", () => {
    downloadCsv("counterbalance").catch((error) => {
      setStatus("Failed");
      setLog(error.message);
    });
  });
})();
