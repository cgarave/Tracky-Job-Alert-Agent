"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDeliveryHistory } from "@/lib/api";

type Delivery = { job_id?: string; recipient_id?: string; platform?: string; state?: string; attempts?: number; last_error?: string; updated_at?: string };

export function DeliveryHistoryTab() {
  const [rows, setRows] = useState<Delivery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await fetchDeliveryHistory(); setRows(result.deliveries as Delivery[]); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load delivery history"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="delivery-title">
    <div className="flex items-center justify-between border-b border-slate-200 p-4">
      <div><h2 id="delivery-title" className="text-sm font-semibold text-slate-900">Notification delivery history</h2><p className="text-xs text-slate-500">Recent queued, sent, and retrying alerts.</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
    </div>
    {error ? <div className="p-6 text-sm text-red-700" role="alert">{error}</div> : loading ? <div className="p-8 text-center text-sm text-slate-500" role="status">Loading delivery history…</div> : rows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No notifications have been queued yet.</div> :
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">State</th><th className="p-3">Channel</th><th className="p-3">Recipient</th><th className="p-3">Attempts</th><th className="p-3">Updated</th><th className="p-3">Error</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.job_id}-${row.recipient_id}-${i}`} className="border-t border-slate-100"><td className="p-3 font-semibold capitalize">{row.state}</td><td className="p-3 capitalize">{row.platform}</td><td className="p-3">{row.recipient_id}</td><td className="p-3">{row.attempts || 0}</td><td className="p-3">{row.updated_at || "—"}</td><td className="max-w-xs truncate p-3 text-red-600" title={row.last_error}>{row.last_error || "—"}</td></tr>)}</tbody></table></div>}
  </section>;
}
