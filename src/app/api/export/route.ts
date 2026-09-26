import { formatDate, formatDateTime, STATUS_LABELS, todayIso } from "@/lib/format";
import { parseOrderFilters } from "@/lib/filters";
import { exportRows } from "@/lib/orders";

export const dynamic = "force-dynamic";

const HEADER = [
  "Encomenda",
  "Recebida",
  "Empresa",
  "Contacto",
  "Email",
  "Data pretendida",
  "Estado",
  "Em preparação",
  "Enviada",
  "Entregue",
  "Cancelada",
  "Referência",
  "Produto",
  "Unidade",
  "Quantidade",
  "Preço unitário",
  "Subtotal",
];

// Excel (pt-PT) friendly: ";" separator, decimal comma, UTF-8 BOM, CRLF.
// Text that Excel would run as a formula (= + - @, tab, CR) gets a leading apostrophe:
// contact and company names come from the customer's email, so they are untrusted.
function field(value: string | number | null): string {
  if (value === null) return "";
  const text =
    typeof value === "number"
      ? value.toLocaleString("pt-PT", { useGrouping: false, maximumFractionDigits: 3 })
      : /^[=+\-@\t\r]/.test(value)
        ? `'${value}`
        : value;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await exportRows(parseOrderFilters(params));

  const lines = [HEADER, ...rows.map((r) => [
    r.order.id,
    formatDateTime(r.order.receivedAt).replace(",", ""),
    r.order.companyName,
    r.order.contact,
    r.order.customerEmail,
    formatDate(r.order.requestedDate),
    STATUS_LABELS[r.order.status],
    formatDate(r.order.timeline.em_preparacao),
    formatDate(r.order.timeline.enviada),
    formatDate(r.order.timeline.entregue),
    formatDate(r.order.timeline.cancelada),
    r.reference,
    r.description,
    r.unit,
    r.quantity,
    r.unitPrice,
    r.subtotal,
  ])];
  const csv = "﻿" + lines.map((cols) => cols.map(field).join(";")).join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="encomendas-${todayIso()}.csv"`,
    },
  });
}
