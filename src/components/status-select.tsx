"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateStatus } from "@/app/encomendas/actions";
import { STATUSES, type OrderStatus } from "@/lib/filters";
import { STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "./status-badge";

// Applies immediately; only "Cancelada" asks for confirmation.
// compact: colored like the status badge, for use inside a clickable table row.
export function StatusSelect({
  orderId,
  status,
  compact = false,
}: {
  orderId: number;
  status: OrderStatus;
  compact?: boolean;
}) {
  const [current, setCurrent] = useState(status);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: OrderStatus) {
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      try {
        await updateStatus(orderId, next);
      } catch {
        setCurrent(previous);
      }
    });
  }

  // Stops clicks (also from the dropdown and dialog portals) from reaching the row link.
  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <Select
        value={current}
        disabled={pending}
        onValueChange={(v) => (v === "cancelada" ? setConfirmCancel(true) : apply(v as OrderStatus))}
      >
        <SelectTrigger
          aria-label="Estado"
          className={cn(compact ? `h-7 w-36 border-0 ${STATUS_COLORS[current]}` : "w-44")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta encomenda?</AlertDialogTitle>
            <AlertDialogDescription>
              A encomenda passa a &quot;Cancelada&quot; e deixa de contar no Resumo. Pode voltar a mudar o
              estado mais tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => apply("cancelada")}>
              Cancelar encomenda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
