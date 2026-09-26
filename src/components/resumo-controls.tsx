"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { StatsParams } from "@/lib/stats";

// Every change updates the URL right away; the server page recomputes the stats.
export function ResumoControls({ params, query }: { params: StatsParams; query: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(changes: Record<string, string | null>) {
    const q = new URLSearchParams(query);
    for (const [key, value] of Object.entries(changes)) {
      if (value) q.set(key, value);
      else q.delete(key);
    }
    startTransition(() => router.replace(`/resumo?${q}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="De">
        <Input type="date" className="h-8" defaultValue={params.from ?? ""} onChange={(e) => set({ de: e.target.value || null })} />
      </Field>
      <Field label="Até">
        <Input type="date" className="h-8" defaultValue={params.to ?? ""} onChange={(e) => set({ ate: e.target.value || null })} />
      </Field>
      <Field label="Agrupar por">
        <NativeSelect value={params.grouping} onChange={(e) => set({ agrupar: e.target.value })}>
          <NativeSelectOption value="dia">Dia</NativeSelectOption>
          <NativeSelectOption value="semana">Semana</NativeSelectOption>
          <NativeSelectOption value="mes">Mês</NativeSelectOption>
          <NativeSelectOption value="ano">Ano</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Mostrar">
        <NativeSelect value={params.metric} onChange={(e) => set({ metrica: e.target.value })}>
          <NativeSelectOption value="encomendas">Nº de encomendas</NativeSelectOption>
          <NativeSelectOption value="valor">Valor (€)</NativeSelectOption>
        </NativeSelect>
      </Field>
      {(params.from || params.to) && (
        <Button variant="ghost" onClick={() => set({ de: null, ate: null })}>
          Todo o período
        </Button>
      )}
      {pending && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
