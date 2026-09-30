import type postgres from "postgres";
import { getDb } from "./db";
import { STATUSES, type OrderStatus } from "./filters";
import { todayIso } from "./format";

// Resumo page. Values use the price saved on each line. Cancelled orders are excluded,
// except in the per-status breakdown. The period filters on the received date (Lisbon).

export const GROUPINGS = { dia: "day", semana: "week", mes: "month", ano: "year" } as const;
export type Grouping = keyof typeof GROUPINGS;
export type Metric = "encomendas" | "valor";

export type StatsParams = {
  from: string | null; // YYYY-MM-DD
  to: string | null;
  grouping: Grouping;
  metric: Metric;
  clientsBy: "encomendas" | "valor";
  productsBy: "quantidade" | "valor";
};

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const DAY_MS = 86_400_000;
// "YYYY-MM-DD" → UTC midnight in ms, or null if it isn't a real date (e.g. 2026-13-45).
function isoToUtc(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  return new Date(t).toISOString().startsWith(iso) ? t : null;
}

export function parseStatsParams(params: SearchParams): StatsParams {
  const from = first(params.de);
  const to = first(params.ate);
  const grouping = first(params.agrupar);
  return {
    from: isoToUtc(from) !== null ? from : null,
    to: isoToUtc(to) !== null ? to : null,
    grouping: Object.hasOwn(GROUPINGS, grouping) ? (grouping as Grouping) : "mes",
    metric: first(params.metrica) === "valor" ? "valor" : "encomendas",
    clientsBy: first(params.clientes) === "encomendas" ? "encomendas" : "valor",
    productsBy: first(params.produtos) === "quantidade" ? "quantidade" : "valor",
  };
}

// ---------- Chart size ----------

export const MAX_CHART_COLUMNS = 30;

// How many columns the chart has from `from` to `to` (inclusive) with this grouping.
// Weeks start on Monday, like Postgres date_trunc('week').
export function columnCount(from: string, to: string, grouping: Grouping): number {
  const a = isoToUtc(from);
  const b = isoToUtc(to);
  if (a === null || b === null || b < a) return 0;
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  const monday = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS;
  switch (grouping) {
    case "dia":
      return (b - a) / DAY_MS + 1;
    case "semana":
      return (monday(b) - monday(a)) / (7 * DAY_MS) + 1;
    case "mes":
      return (y2 - y1) * 12 + (m2 - m1) + 1;
    case "ano":
      return y2 - y1 + 1;
  }
}

export type ChartRange = {
  from: string;
  to: string;
  columns: number;
  fits: boolean;
  alternatives: Grouping[]; // other groupings that fit, when this one doesn't
};

export function chartRange(from: string, to: string, grouping: Grouping): ChartRange {
  const columns = columnCount(from, to, grouping);
  const fits = columns <= MAX_CHART_COLUMNS;
  const alternatives = fits
    ? []
    : (Object.keys(GROUPINGS) as Grouping[]).filter(
        (g) => g !== grouping && columnCount(from, to, g) <= MAX_CHART_COLUMNS,
      );
  return { from, to, columns, fits, alternatives };
}

// ---------- Stats ----------

export type Stats = {
  orders: number;
  totalValue: number;
  averageValue: number;
  clients: number;
  toReview: number; // orders with an unknown code, a missing quantity or no lines
  chart: ChartRange | null; // null when the period has no orders
  series: { bucket: string; orders: number; value: number }[]; // bucket = YYYY-MM-DD (start); empty if too many columns
  byStatus: { status: OrderStatus; orders: number; value: number }[];
  byFamily: { family: string; value: number }[];
  topClients: { name: string; orders: number; value: number }[];
  topProducts: { reference: string; description: string; unit: string; quantity: number; value: number }[];
};

export type DueDelivery = {
  id: number;
  companyName: string;
  requestedDate: string;
  status: OrderStatus;
  value: number;
  daysLeft: number; // negative = late
};

function period(sql: postgres.Sql, p: StatsParams) {
  const day = sql`(o.received_at AT TIME ZONE 'Europe/Lisbon')::date`;
  return sql`
    ${p.from ? sql`AND ${day} >= ${p.from}::date` : sql``}
    ${p.to ? sql`AND ${day} <= ${p.to}::date` : sql``}
  `;
}

// One row per order in the period: its client, value and whether it needs review.
function perOrder(sql: postgres.Sql, p: StatsParams) {
  return sql`
    SELECT o.id, o.status, o.received_at,
           coalesce(o.company_id::text, o.customer_email) AS client_key,
           coalesce(c.name, o.customer_email) AS client_name,
           coalesce(sum(l.quantity * l.unit_price_eur), 0) AS value,
           coalesce(bool_or(l.unit_price_eur IS NULL OR l.quantity IS NULL), true) AS incomplete
    FROM orders o
    LEFT JOIN companies c ON c.id = o.company_id
    LEFT JOIN order_lines l ON l.order_id = o.id
    LEFT JOIN catalog_products cp ON cp.reference = l.reference
    WHERE TRUE ${period(sql, p)}
    GROUP BY o.id, c.name
  `;
}

export async function getStats(p: StatsParams): Promise<Stats> {
  const sql = getDb();
  const unit = GROUPINGS[p.grouping];
  const clientsOrder = p.clientsBy === "encomendas" ? sql`orders DESC, value DESC` : sql`value DESC, orders DESC`;
  const productsOrder = p.productsBy === "quantidade" ? sql`quantity DESC, value DESC` : sql`value DESC, quantity DESC`;

  // The chart covers the chosen period, or the first to the last order when there isn't one.
  const [range] = await sql`
    SELECT min(d)::text AS lo, max(d)::text AS hi
    FROM (
      SELECT (o.received_at AT TIME ZONE 'Europe/Lisbon')::date AS d
      FROM orders o WHERE o.status <> 'cancelada' ${period(sql, p)}
    ) AS days
  `;
  const lo = p.from ?? range.lo;
  const hi = p.to ?? range.hi;
  const chart = lo && hi ? chartRange(lo, hi, p.grouping) : null;

  const [[summary], series, byStatus, byFamily, topClients, topProducts] = await Promise.all([
    sql`
      WITH po AS (${perOrder(sql, p)})
      SELECT count(*)::int AS orders, coalesce(sum(value), 0) AS total_value,
             count(DISTINCT client_key)::int AS clients,
             count(*) FILTER (WHERE incomplete)::int AS to_review
      FROM po WHERE status <> 'cancelada'
    `,
    // Every bucket in the range, empty ones as 0. Skipped when there would be too many columns.
    chart?.fits
      ? sql`
          WITH po AS (${perOrder(sql, p)}),
          b AS (
            SELECT date_trunc(${unit}, received_at AT TIME ZONE 'Europe/Lisbon') AS bucket,
                   count(*) AS orders, sum(value) AS value
            FROM po WHERE status <> 'cancelada' GROUP BY 1
          )
          SELECT g.bucket::date::text AS bucket, coalesce(b.orders, 0)::int AS orders,
                 coalesce(b.value, 0) AS value
          FROM generate_series(
                 date_trunc(${unit}, ${chart.from}::timestamp),
                 date_trunc(${unit}, ${chart.to}::timestamp),
                 ('1 ' || ${unit})::interval
               ) AS g(bucket)
          LEFT JOIN b ON b.bucket = g.bucket
          ORDER BY g.bucket
        `
      : Promise.resolve([]),
    sql`
      WITH po AS (${perOrder(sql, p)})
      SELECT status, count(*)::int AS orders, coalesce(sum(value), 0) AS value
      FROM po GROUP BY status
    `,
    sql`
      SELECT cp.family, sum(l.quantity * l.unit_price_eur) AS value
      FROM orders o
      JOIN order_lines l ON l.order_id = o.id
      JOIN catalog_products cp ON cp.reference = l.reference
      WHERE o.status <> 'cancelada' AND l.quantity IS NOT NULL AND l.unit_price_eur IS NOT NULL ${period(sql, p)}
      GROUP BY cp.family
      ORDER BY value DESC
    `,
    sql`
      WITH po AS (${perOrder(sql, p)})
      SELECT min(client_name) AS name, count(*)::int AS orders, sum(value) AS value
      FROM po WHERE status <> 'cancelada'
      GROUP BY client_key
      ORDER BY ${clientsOrder}, name
      LIMIT 10
    `,
    sql`
      -- Name and unit as saved on the lines (the most recent one, if the product was renamed)
      SELECT l.reference,
             (array_agg(l.description ORDER BY l.id DESC))[1] AS description,
             (array_agg(l.unit ORDER BY l.id DESC))[1] AS unit,
             sum(l.quantity)::int AS quantity, sum(l.quantity * l.unit_price_eur) AS value
      FROM orders o
      JOIN order_lines l ON l.order_id = o.id
      WHERE o.status <> 'cancelada' AND l.quantity IS NOT NULL AND l.unit_price_eur IS NOT NULL ${period(sql, p)}
      GROUP BY l.reference
      ORDER BY ${productsOrder}, l.reference
      LIMIT 10
    `,
  ]);

  const statusRows = new Map(byStatus.map((r) => [r.status as OrderStatus, r]));
  const totalValue = Number(summary.total_value);

  return {
    orders: summary.orders,
    totalValue,
    averageValue: summary.orders ? totalValue / summary.orders : 0,
    chart,
    clients: summary.clients,
    toReview: summary.to_review,
    series: series.map((r) => ({ bucket: r.bucket, orders: r.orders, value: Number(r.value) })),
    byStatus: STATUSES.map((status) => ({
      status,
      orders: statusRows.get(status)?.orders ?? 0,
      value: Number(statusRows.get(status)?.value ?? 0),
    })),
    byFamily: byFamily.map((r) => ({ family: r.family, value: Number(r.value) })),
    topClients: topClients.map((r) => ({ name: r.name, orders: r.orders, value: Number(r.value) })),
    topProducts: topProducts.map((r) => ({
      reference: r.reference,
      description: r.description,
      unit: r.unit,
      quantity: r.quantity,
      value: Number(r.value),
    })),
  };
}

// Not affected by the period: what still has to go out (pending or in preparation)
// and is late or due in the next 7 days.
export async function getDueDeliveries(): Promise<DueDelivery[]> {
  const sql = getDb();
  const today = todayIso();
  const rows = await sql`
    SELECT o.id, coalesce(c.name, o.customer_email) AS company_name,
           o.requested_date::text AS requested_date, o.status,
           (o.requested_date - ${today}::date)::int AS days_left,
           coalesce(sum(l.quantity * l.unit_price_eur), 0) AS value
    FROM orders o
    LEFT JOIN companies c ON c.id = o.company_id
    LEFT JOIN order_lines l ON l.order_id = o.id
    -- Only a delivered (or cancelled) order is off the hook: a shipped one can still be late.
    WHERE o.status IN ('pendente', 'em_preparacao', 'enviada')
      AND o.requested_date <= ${today}::date + 7
    GROUP BY o.id, c.name
    ORDER BY o.requested_date, o.id
  `;
  return rows.map((r) => ({
    id: r.id,
    companyName: r.company_name,
    requestedDate: r.requested_date,
    status: r.status,
    value: Number(r.value),
    daysLeft: r.days_left,
  }));
}
