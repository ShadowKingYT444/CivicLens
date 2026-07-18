"use client";

import { useState } from "react";
import { TopIdentity } from "./mobile/TopIdentity";

type AdminAction = "congress" | "members";

const endpoints: Record<AdminAction, string> = {
  congress: "/api/admin/ingest/congress",
  members: "/api/admin/ingest/members",
};

export function AdminConsole() {
  const [token, setToken] = useState("");
  const [log, setLog] = useState("Admin actions are inert unless the backend accepts the token.");
  const [loading, setLoading] = useState<AdminAction | null>(null);

  async function runAction(action: AdminAction) {
    setLoading(action);
    setLog(`Calling ${endpoints[action]}...`);

    try {
      const response = await fetch(endpoints[action], {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-admin-token": token,
        },
        body: JSON.stringify({ dryRun: false }),
      });
      const text = await response.text();
      setLog(text || `Request finished with ${response.status}.`);
    } catch (reason) {
      setLog(reason instanceof Error ? reason.message : "Admin route unavailable.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="page-shell">
      <TopIdentity title="Admin" subtitle="Developer tools stay out of the main student flow." />
      <div className="panel prominent form-grid">
        <div>
          <p className="eyebrow">Admin Controls</p>
          <h1 className="section-title">Run safe ingestion jobs.</h1>
          <p className="lede">
            Tokens stay in component state only. Demo mode routes should return safe status
            responses without changing external systems.
          </p>
        </div>
        <label className="field-label" htmlFor="admin-token">
          Admin token
          <span>Not persisted in local storage.</span>
          <input
            id="admin-token"
            className="input"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="action-row">
          <button
            type="button"
            className="button"
            disabled={!token || loading !== null}
            onClick={() => void runAction("congress")}
          >
            {loading === "congress" ? "Running..." : "Ingest Congress"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={!token || loading !== null}
            onClick={() => void runAction("members")}
          >
            {loading === "members" ? "Running..." : "Ingest Members"}
          </button>
        </div>
      </div>

      <aside className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Response</p>
            <h2 className="section-title">Route output</h2>
          </div>
          <span className="status-pill">Local only</span>
        </div>
        <pre className="admin-log" aria-live="polite">
          {log}
        </pre>
      </aside>
    </section>
  );
}
