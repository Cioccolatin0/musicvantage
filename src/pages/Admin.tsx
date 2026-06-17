import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const statusQuery = trpc.admin.cacheStatus.useQuery(undefined, { retry: false });
  const clearMutation = trpc.admin.clearCaches.useMutation();

  const onClear = async () => {
    setMsg("Clearing caches...");
    try {
      await clearMutation.mutateAsync();
      await statusQuery.refetch();
      setMsg("Caches cleared");
    } catch (err: any) {
      setMsg(err?.message || String(err));
    }
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>Admin Diagnostics</h1>
      {statusQuery.isLoading ? (
        <p>Loading status…</p>
      ) : statusQuery.error ? (
        <div>
          <p>Unable to load status (not authenticated or error):</p>
          <pre style={{ color: "#900" }}>{String(statusQuery.error)}</pre>
        </div>
      ) : (
        <div>
          <p>pythonCache size: {statusQuery.data?.pythonCacheSize}</p>
          <p>searchPrefixCache size: {statusQuery.data?.searchPrefixCacheSize}</p>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={onClear} disabled={clearMutation.isLoading}>
          {clearMutation.isLoading ? "Clearing…" : "Clear Server Caches"}
        </button>
        {msg ? <div style={{ marginTop: 8 }}>{msg}</div> : null}
      </div>
    </div>
  );
}
