"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncNow } from "@/app/encomendas/actions";
import { formatTime } from "@/lib/format";
import type { SyncStatus } from "@/lib/sync";

export function SyncBar({ status }: { status: SyncStatus | null }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncStatus | null>(null);
  const shown = result ?? status;

  function sync() {
    startTransition(async () => {
      setResult(await syncNow());
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 sm:flex-row-reverse">
      <Button onClick={sync} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Sincronizar
      </Button>
      {shown && (
        <p className="text-xs text-muted-foreground">
          Última sincronização: {formatTime(shown.at)}
          {(shown.ok || shown.newOrders > 0) &&
            ` · ${shown.newOrders === 1 ? "1 nova" : `${shown.newOrders} novas`}`}
          {shown.message && <span className="text-destructive"> · {shown.message}</span>}
        </p>
      )}
    </div>
  );
}
