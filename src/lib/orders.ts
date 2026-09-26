import type postgres from "postgres";
import { getDb } from "./db";
import type { ExtractedLine } from "./extraction/types";
import { STATUSES, type ListFilters, type OrderStatus } from "./filters";

// ---------- Sync ----------

export type NewOrder = {
  emailId: string;
  companyId: number | null;
  contact: string | null;
  customerEmail: string;
  receivedAt: string;
  requestedDate: string | null;
  emailBody: string;
  lines: ExtractedLine[];
};

export async function existingEmailIds(): Promise<Set<string>> {
  const rows = await getDb()<{ email_id: string }[]>`SELECT email_id FROM orders`;
  return new Set(rows.map((r) => r.email_id));
}

// Runs inside the sync transaction. Returns null if the email was already saved.
export async function insertOrder(sql: postgres.TransactionSql, order: NewOrder): Promise<number | null> {
  const [inserted] = await sql<{ id: number }[]>`
    INSERT INTO orders (email_id, company_id, contact, customer_email, received_at, requested_date, email_body)
    VALUES (${order.emailId}, ${order.companyId}, ${order.contact}, ${order.customerEmail},
            ${order.receivedAt}, ${order.requestedDate}, ${order.emailBody})
    ON CONFLICT (email_id) DO NOTHING
    RETURNING id
  `;
  if (!inserted) return null;

  await insertLines(
    sql,
    inserted.id,
    order.lines.map((l) => ({ ...l, kept: null })),
  );
  return inserted.id;
}

// What a line keeps from the catalog at the moment it is saved.
export type LineSnapshot = { unitPrice: string; description: string | null; unit: string | null };

type LineToInsert = { reference: string; quantity: number | null; kept: LineSnapshot | null };

// Inserts lines in the given order. Each line copies price, name and unit from `kept` when
// given, otherwise from the active catalog now (all NULL for an unknown or discontinued code).
async function insertLines(sql: postgres.TransactionSql, orderId: number, lines: LineToInsert[]) {
  if (lines.length === 0) return;
  await sql`
    INSERT INTO order_lines (order_id, reference, quantity, unit_price_eur, description, unit)
    SELECT ${orderId}, l.reference, l.quantity,
           CASE WHEN l.kept_price IS NOT NULL THEN l.kept_price ELSE p.price_eur END,
           CASE WHEN l.kept_price IS NOT NULL THEN l.kept_description ELSE p.description END,
           CASE WHEN l.kept_price IS NOT NULL THEN l.kept_unit ELSE p.unit END
    FROM unnest(
           ${lines.map((l) => l.reference)}::text[],
           ${lines.map((l) => l.quantity)}::int[],
           ${lines.map((l) => l.kept?.unitPrice ?? null)}::numeric[],
           ${lines.map((l) => l.kept?.description ?? null)}::text[],
           ${lines.map((l) => l.kept?.unit ?? null)}::text[]
         ) WITH ORDINALITY AS l(reference, quantity, kept_price, kept_description, kept_unit, n)
    LEFT JOIN catalog_products p ON p.reference = l.reference AND p.active
    ORDER BY l.n
  `;
}

// When an order is edited, a product that was already on it keeps what it was saved with
// (price, name, unit); a new, corrected or still-unknown reference gets null (→ catalog now).
export function keptSnapshots(
  references: string[],
  previous: ({ reference: string } & { unitPrice: string | null; description: string | null; unit: string | null })[],
): (LineSnapshot | null)[] {
  const saved = new Map<string, LineSnapshot>();
  for (const p of previous) {
    if (p.unitPrice !== null) saved.set(p.reference, { unitPrice: p.unitPrice, description: p.description, unit: p.unit });
  }
  return references.map((r) => saved.get(r) ?? null);
}

// ---------- List ----------

export type OrderLineSummary = {
  reference: string;
  quantity: number | null;
  description: string | null; // null = code not in the catalog when the line was saved
  unit: string | null;
};

export type OrderListItem = {
  id: number;
  emailId: string;
  receivedAt: Date;
  requestedDate: string | null;
  status: OrderStatus;
  contact: string | null;
  customerEmail: string;
  companyName: string | null;
  lines: OrderLineSummary[]; // in email order
  timeline: StatusDates;
  total: number;
  incomplete: boolean;
};

// Whitelist: user input never reaches the SQL text.
function orderBy(sql: postgres.Sql, f: ListFilters) {
  const dir = f.dir === "asc" ? sql`ASC` : sql`DESC`;
  const column = {
    recebida: sql`o.received_at`,
    pretendida: sql`o.requested_date`,
    empresa: sql`lower(coalesce(c.name, o.customer_email))`,
    total: sql`total`,
    estado: sql`array_position(${STATUSES as unknown as string[]}::text[], o.status)`,
  }[f.sort];
  return sql`ORDER BY ${column} ${dir} NULLS LAST, o.received_at DESC, o.id DESC`;
}

function where(sql: postgres.Sql, f: ListFilters) {
  const date =
    f.dateField === "pretendida"
      ? sql`o.requested_date`
      : sql`(o.received_at AT TIME ZONE 'Europe/Lisbon')::date`;
  return sql`
    WHERE TRUE
    ${f.companyId ? sql`AND o.company_id = ${f.companyId}` : sql``}
    ${f.status ? sql`AND o.status = ${f.status}` : sql``}
    ${f.from ? sql`AND ${date} >= ${f.from}::date` : sql``}
    ${f.to ? sql`AND ${date} <= ${f.to}::date` : sql``}
  `;
}

// Total = Σ quantity × the price saved on each line. Lines with an unknown code or no
// quantity are left out and flag the order as incomplete (so does an order with no lines).
export async function listOrders(f: ListFilters): Promise<OrderListItem[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT o.id, o.email_id, o.received_at, o.requested_date::text AS requested_date,
           o.status, o.contact, o.customer_email, c.name AS company_name,
           o.preparation_date::text AS em_preparacao, o.shipped_date::text AS enviada,
           o.delivered_date::text AS entregue, o.cancelled_date::text AS cancelada,
           coalesce(
             json_agg(json_build_object(
               'reference', l.reference, 'quantity', l.quantity,
               'description', l.description, 'unit', l.unit
             ) ORDER BY l.id) FILTER (WHERE l.id IS NOT NULL),
             '[]'
           ) AS lines,
           coalesce(sum(l.quantity * l.unit_price_eur), 0) AS total,
           coalesce(bool_or(l.unit_price_eur IS NULL OR l.quantity IS NULL), true) AS incomplete
    FROM orders o
    LEFT JOIN companies c ON c.id = o.company_id
    LEFT JOIN order_lines l ON l.order_id = o.id
    ${where(sql, f)}
    GROUP BY o.id, c.name
    ${orderBy(sql, f)}
  `;
  return rows.map((r) => ({
    id: r.id,
    emailId: r.email_id,
    receivedAt: r.received_at,
    requestedDate: r.requested_date,
    status: r.status,
    contact: r.contact,
    customerEmail: r.customer_email,
    companyName: r.company_name,
    lines: r.lines,
    timeline: {
      em_preparacao: r.em_preparacao,
      enviada: r.enviada,
      entregue: r.entregue,
      cancelada: r.cancelada,
    },
    total: Number(r.total),
    incomplete: r.incomplete,
  }));
}

export async function listCompanies(): Promise<{ id: number; name: string }[]> {
  return getDb()<{ id: number; name: string }[]>`SELECT id, name FROM companies ORDER BY lower(name)`;
}

// ---------- CSV export ----------

export type ExportRow = {
  order: OrderListItem;
  reference: string | null;
  description: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  subtotal: number | null;
};

// One row per order line (same filters and sort as the list). An order with no
// lines still gets one row, so it isn't lost from the export.
export async function exportRows(f: ListFilters): Promise<ExportRow[]> {
  const orders = await listOrders(f);
  if (orders.length === 0) return [];

  const sql = getDb();
  const lines = await sql`
    SELECT l.order_id, l.reference, l.quantity, l.description, l.unit,
           l.unit_price_eur AS price_eur, l.quantity * l.unit_price_eur AS subtotal
    FROM order_lines l
    WHERE l.order_id IN ${sql(orders.map((o) => o.id))}
    ORDER BY l.id
  `;

  return orders.flatMap((order) => {
    const own = lines.filter((l) => l.order_id === order.id);
    if (own.length === 0) {
      return [{ order, reference: null, description: null, unit: null, quantity: null, unitPrice: null, subtotal: null }];
    }
    return own.map((l) => ({
      order,
      reference: l.reference,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.price_eur === null ? null : Number(l.price_eur),
      subtotal: l.subtotal === null ? null : Number(l.subtotal),
    }));
  });
}

// ---------- Detail ----------

export type OrderLineDetail = OrderLineSummary & {
  priceEur: number | null;
  subtotal: number | null; // null = unknown code or no quantity
};

export type OrderDetail = {
  id: number;
  emailId: string;
  companyName: string | null;
  contact: string | null;
  customerEmail: string;
  receivedAt: Date;
  requestedDate: string | null;
  status: OrderStatus;
  emailBody: string;
  timeline: StatusDates;
  lines: OrderLineDetail[];
  total: number;
  incomplete: boolean;
};

export async function getOrder(id: number): Promise<OrderDetail | null> {
  const sql = getDb();
  const [o] = await sql`
    SELECT o.id, o.email_id, c.name AS company_name, o.contact, o.customer_email, o.received_at,
           o.requested_date::text AS requested_date, o.status, o.email_body,
           o.preparation_date::text AS em_preparacao, o.shipped_date::text AS enviada,
           o.delivered_date::text AS entregue, o.cancelled_date::text AS cancelada
    FROM orders o
    LEFT JOIN companies c ON c.id = o.company_id
    WHERE o.id = ${id}
  `;
  if (!o) return null;

  const rows = await sql`
    SELECT l.reference, l.quantity, l.description, l.unit,
           l.unit_price_eur AS price_eur, l.quantity * l.unit_price_eur AS subtotal
    FROM order_lines l
    WHERE l.order_id = ${id}
    ORDER BY l.id
  `;
  const lines: OrderLineDetail[] = rows.map((r) => ({
    reference: r.reference,
    quantity: r.quantity,
    description: r.description,
    unit: r.unit,
    priceEur: r.price_eur === null ? null : Number(r.price_eur),
    subtotal: r.subtotal === null ? null : Number(r.subtotal),
  }));

  return {
    id: o.id,
    emailId: o.email_id,
    companyName: o.company_name,
    contact: o.contact,
    customerEmail: o.customer_email,
    receivedAt: o.received_at,
    requestedDate: o.requested_date,
    status: o.status,
    emailBody: o.email_body,
    timeline: {
      em_preparacao: o.em_preparacao,
      enviada: o.enviada,
      entregue: o.entregue,
      cancelada: o.cancelada,
    },
    lines,
    total: lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0),
    incomplete: lines.length === 0 || lines.some((l) => l.subtotal === null),
  };
}

// ---------- Status timeline ----------

// The day each stage was reached (YYYY-MM-DD), or null. "Pendente" = the received date.
export type Milestone = "em_preparacao" | "enviada" | "entregue" | "cancelada";
export type StatusDates = Record<Milestone, string | null>;

// Whitelist: milestone → column (never interpolate user input into SQL).
const MILESTONE_COLUMNS: Record<Milestone, string> = {
  em_preparacao: "preparation_date",
  enviada: "shipped_date",
  entregue: "delivered_date",
  cancelada: "cancelled_date",
};
const STAGES = ["pendente", "em_preparacao", "enviada", "entregue"] as const;

// New dates after a status change: the stage entered gets `today` (unless it already has a
// date); going back clears the later stages; cancelling keeps the progress made so far.
export function nextStatusDates(dates: StatusDates, status: OrderStatus, today: string): StatusDates {
  if (status === "cancelada") return { ...dates, cancelada: dates.cancelada ?? today };
  const reached = STAGES.indexOf(status);
  const next: StatusDates = { ...dates, cancelada: null };
  for (const [i, stage] of STAGES.entries()) {
    if (stage === "pendente") continue;
    if (i > reached) next[stage] = null;
    else if (i === reached) next[stage] = dates[stage] ?? today;
  }
  return next;
}

export async function updateStatus(id: number, status: OrderStatus, today: string): Promise<void> {
  await getDb().begin(async (tx) => {
    const [row] = await tx`
      SELECT preparation_date::text AS em_preparacao, shipped_date::text AS enviada,
             delivered_date::text AS entregue, cancelled_date::text AS cancelada
      FROM orders WHERE id = ${id} FOR UPDATE
    `;
    if (!row) throw new Error(`Order ${id} not found`);
    const d = nextStatusDates(row as StatusDates, status, today);
    await tx`
      UPDATE orders SET status = ${status},
        preparation_date = ${d.em_preparacao}, shipped_date = ${d.enviada},
        delivered_date = ${d.entregue}, cancelled_date = ${d.cancelada}
      WHERE id = ${id}
    `;
  });
}

// Corrects the date of a stage already reached (validated by the caller).
export async function setStatusDate(id: number, milestone: Milestone, date: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE orders SET ${sql(MILESTONE_COLUMNS[milestone])} = ${date} WHERE id = ${id}`;
}

export async function getOrderDates(
  id: number,
): Promise<{ receivedDay: string; dates: StatusDates } | null> {
  const [row] = await getDb()`
    SELECT (received_at AT TIME ZONE 'Europe/Lisbon')::date::text AS received_day,
           preparation_date::text AS em_preparacao, shipped_date::text AS enviada,
           delivered_date::text AS entregue, cancelled_date::text AS cancelada
    FROM orders WHERE id = ${id}
  `;
  if (!row) return null;
  const { received_day, ...dates } = row;
  return { receivedDay: received_day, dates: dates as StatusDates };
}

export type OrderEdits = {
  contact: string | null;
  requestedDate: string | null;
  lines: { reference: string; quantity: number }[];
};

// One transaction: update the order, replace all its lines (keeping what each kept product was saved with).
export async function saveOrderEdits(id: number, edits: OrderEdits): Promise<void> {
  await getDb().begin(async (tx) => {
    await tx`
      UPDATE orders SET contact = ${edits.contact}, requested_date = ${edits.requestedDate}
      WHERE id = ${id}
    `;
    const previous = await tx<{ reference: string; unitPrice: string | null; description: string | null; unit: string | null }[]>`
      SELECT reference, unit_price_eur AS "unitPrice", description, unit
      FROM order_lines WHERE order_id = ${id}
    `;
    const kept = keptSnapshots(edits.lines.map((l) => l.reference), previous);
    await tx`DELETE FROM order_lines WHERE order_id = ${id}`;
    await insertLines(tx, id, edits.lines.map((l, i) => ({ ...l, kept: kept[i] })));
  });
}
