"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  DEFAULT_FILTERS,
  filtersToQuery,
  hasActiveFilters,
  STATUSES,
  type ListFilters,
  type SortKey,
} from "@/lib/filters";
import { STATUS_LABELS } from "@/lib/format";

const SORT_LABELS: Record<SortKey, string> = {
  recebida: "Data recebida",
  pretendida: "Data pretendida",
  empresa: "Empresa",
  total: "Total",
  estado: "Estado",
};

// Every change updates the URL right away; the server page re-renders the list.
export function OrderFilters({
  filters: initial,
  companies,
  exportAction,
}: {
  filters: ListFilters;
  companies: { id: number; name: string }[];
  exportAction: React.ReactNode;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [pending, startTransition] = useTransition();

  function apply(next: ListFilters) {
    setFilters(next);
    startTransition(() => router.replace(`/encomendas?${filtersToQuery(next)}`, { scroll: false }));
  }
  const set = (patch: Partial<ListFilters>) => apply({ ...filters, ...patch });

  // Two rows: what to show (filters), then how to show it (sort) and export.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Cliente">
          <NativeSelect
            className="w-52"
            value={filters.companyId ?? ""}
            onChange={(e) => set({ companyId: e.target.value ? Number(e.target.value) : null })}
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {companies.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Estado">
          <NativeSelect
            value={filters.status ?? ""}
            onChange={(e) => set({ status: (e.target.value || null) as ListFilters["status"] })}
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Filtrar por data">
          <NativeSelect
            value={filters.dateField}
            onChange={(e) => set({ dateField: e.target.value as ListFilters["dateField"] })}
          >
            <NativeSelectOption value="recebida">Recebida</NativeSelectOption>
            <NativeSelectOption value="pretendida">Pretendida</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field label="De">
          <Input
            type="date"
            className="h-8"
            value={filters.from ?? ""}
            onChange={(e) => set({ from: e.target.value || null })}
          />
        </Field>

        <Field label="Até">
          <Input
            type="date"
            className="h-8"
            value={filters.to ?? ""}
            onChange={(e) => set({ to: e.target.value || null })}
          />
        </Field>

        {hasActiveFilters(filters) && (
          <Button variant="ghost" onClick={() => apply({ ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir })}>
            Limpar filtros
          </Button>
        )}
        {pending && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
        <Field label="Ordenar por">
          <div className="flex gap-1">
            <NativeSelect
              value={filters.sort}
              onChange={(e) => set({ sort: e.target.value as SortKey })}
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <NativeSelectOption key={key} value={key}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              onClick={() => set({ dir: filters.dir === "asc" ? "desc" : "asc" })}
            >
              {filters.dir === "asc" ? <ArrowUp /> : <ArrowDown />}
              {filters.dir === "asc" ? "Crescente" : "Decrescente"}
            </Button>
          </div>
        </Field>

        {exportAction}
      </div>
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
