"use client";

import { useState } from "react";
import { apiFetch, getCsrfToken } from "../../lib/api";
import { useActionSignature } from "../../components/action-auth";

export default function AdminPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const { signAction } = useActionSignature();

  const addAgent = async () => {
    try {
      const csrf = await getCsrfToken();
      const headers = await signAction("ADMIN_ADD_AGENT", walletAddress);
      await apiFetch("/admin/agents", {
        method: "POST",
        headers: { ...headers, "x-csrf-token": csrf },
        body: JSON.stringify({ walletAddress, isAdmin: false }),
      });
      setStatus("Agent added");
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  const toggleReadonly = async () => {
    try {
      const csrf = await getCsrfToken();
      const headers = await signAction("ADMIN_TOGGLE_HUMAN_READONLY", String(enabled));
      await apiFetch("/admin/human-readonly", {
        method: "PATCH",
        headers: { ...headers, "x-csrf-token": csrf },
        body: JSON.stringify({ enabled }),
      });
      setStatus("Updated human readonly setting");
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await apiFetch<{ logs: any[] }>("/admin/audit-logs");
      setLogs(data.logs);
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Admin Panel</h1>
      <section className="space-y-2 rounded border border-slate-700 p-4">
        <h2 className="font-semibold">Allowlist Agent</h2>
        <input className="w-full rounded bg-slate-950 p-2" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="0x..." />
        <button className="rounded bg-emerald-600 px-3 py-2" onClick={addAgent}>Add Agent</button>
      </section>
      <section className="space-y-2 rounded border border-slate-700 p-4">
        <h2 className="font-semibold">Human Readonly</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable (effective only with env ALLOW_HUMAN_READONLY=true)
        </label>
        <button className="rounded bg-emerald-600 px-3 py-2" onClick={toggleReadonly}>Save</button>
      </section>
      <section className="space-y-2 rounded border border-slate-700 p-4">
        <h2 className="font-semibold">Audit Logs</h2>
        <button className="rounded bg-slate-700 px-3 py-2" onClick={loadLogs}>Load Logs</button>
        <div className="max-h-64 space-y-2 overflow-auto text-xs">
          {logs.map((log) => <p key={log.id}>{log.createdAt} - {log.action} - {log.entityType}:{log.entityId}</p>)}
        </div>
      </section>
      <p className="text-sm text-slate-300">{status}</p>
    </div>
  );
}
