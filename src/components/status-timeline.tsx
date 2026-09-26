"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { setStatusDate } from "@/app/encomendas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import type { Milestone, StatusDates } from "@/lib/orders";
import { cn } from "@/lib/utils";

const STEPS: { key: Milestone; label: string }[] = [
  { key: "em_preparacao", label: "Em preparação" },
  { key: "enviada", label: "Enviada" },
  { key: "entregue", label: "Entregue" },
  { key: "cancelada", label: "Cancelada" },
];

// When each stage was reached. Dates are set on a status change and can be corrected,
// but never to a day in the future nor before the order was received.
export function StatusTimeline({
  orderId,
  received,
  receivedDay,
  today,
  dates,
}: {
  orderId: number;
  received: string; // "14/09/2026 às 08:42"
  receivedDay: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD, Lisbon
  dates: StatusDates;
}) {
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(key: Milestone) {
    startTransition(async () => {
      const message = await setStatusDate(orderId, key, value);
      setError(message);
      if (!message) setEditing(null);
    });
  }

  // Cancelada only appears when the order was cancelled.
  const steps = STEPS.filter((s) => s.key !== "cancelada" || dates.cancelada);

  return (
    <ol className="space-y-3 text-sm">
      <Step reached label="Recebida" date={received} />
      {steps.map(({ key, label }) => {
        const date = dates[key];
        if (editing === key) {
          return (
            <li key={key} className="relative pl-6">
              <Dot reached cancelled={key === "cancelada"} />
              <div className="font-medium">{label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="h-8 w-40"
                  min={receivedDay}
                  max={today}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-label={`Data: ${label}`}
                />
                <Button size="sm" onClick={() => save(key)} disabled={pending || !value}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
                  Cancelar
                </Button>
              </div>
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </li>
          );
        }
        return (
          <Step
            key={key}
            reached={date !== null}
            cancelled={key === "cancelada"}
            label={label}
            date={date ? formatDate(date) : "—"}
            onEdit={
              date
                ? () => {
                    setValue(date);
                    setError(null);
                    setEditing(key);
                  }
                : undefined
            }
          />
        );
      })}
    </ol>
  );
}

function Step({
  reached,
  cancelled = false,
  label,
  date,
  onEdit,
}: {
  reached: boolean;
  cancelled?: boolean;
  label: string;
  date: string;
  onEdit?: () => void;
}) {
  return (
    <li className="relative flex items-start justify-between gap-2 pl-6">
      <Dot reached={reached} cancelled={cancelled} />
      <div>
        <div className={reached ? "font-medium" : "text-muted-foreground"}>{label}</div>
        <div className={reached ? "text-muted-foreground" : "text-muted-foreground/70"}>{date}</div>
      </div>
      {onEdit && (
        <Button variant="ghost" size="icon" className="size-7" onClick={onEdit} aria-label={`Corrigir data: ${label}`}>
          <Pencil className="size-3.5" />
        </Button>
      )}
    </li>
  );
}

function Dot({ reached, cancelled = false }: { reached: boolean; cancelled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-1 left-0 size-3 rounded-full border-2",
        cancelled
          ? "border-status-cancelada-foreground bg-status-cancelada-foreground"
          : reached
            ? "border-primary bg-primary"
            : "border-border bg-card",
      )}
    />
  );
}
