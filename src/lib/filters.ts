// List filters and sort, read from / written to the URL. No DB: also used by client components.

export const STATUSES = ["pendente", "em_preparacao", "enviada", "entregue", "cancelada"] as const;
export type OrderStatus = (typeof STATUSES)[number];

export const SORT_KEYS = ["recebida", "pretendida", "empresa", "total", "estado"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type ListFilters = {
  companyId: number | null;
  status: OrderStatus | null;
  dateField: "recebida" | "pretendida";
  from: string | null; // YYYY-MM-DD
  to: string | null;
  sort: SortKey;
  dir: "asc" | "desc";
};

export const DEFAULT_FILTERS: ListFilters = {
  companyId: null,
  status: null,
  dateField: "recebida",
  from: null,
  to: null,
  sort: "recebida",
  dir: "desc",
};

type SearchParams = Record<string, string | string[] | undefined>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const oneOf = <T extends string>(values: readonly T[], v: string): T | null =>
  (values as readonly string[]).includes(v) ? (v as T) : null;

// Unknown or invalid values are ignored.
export function parseOrderFilters(params: SearchParams): ListFilters {
  const companyId = Number(first(params.cliente));
  const from = first(params.de);
  const to = first(params.ate);
  return {
    companyId: Number.isInteger(companyId) && companyId > 0 ? companyId : null,
    status: oneOf(STATUSES, first(params.estado)),
    dateField: first(params.data) === "pretendida" ? "pretendida" : "recebida",
    from: ISO_DATE.test(from) ? from : null,
    to: ISO_DATE.test(to) ? to : null,
    sort: oneOf(SORT_KEYS, first(params.ordenar)) ?? DEFAULT_FILTERS.sort,
    dir: first(params.dir) === "asc" ? "asc" : "desc",
  };
}

export function hasActiveFilters(f: ListFilters): boolean {
  return f.companyId !== null || f.status !== null || f.from !== null || f.to !== null;
}

export function filtersToQuery(f: ListFilters): string {
  const q = new URLSearchParams();
  if (f.companyId) q.set("cliente", String(f.companyId));
  if (f.status) q.set("estado", f.status);
  if (f.from || f.to) q.set("data", f.dateField);
  if (f.from) q.set("de", f.from);
  if (f.to) q.set("ate", f.to);
  q.set("ordenar", f.sort);
  q.set("dir", f.dir);
  return q.toString();
}
