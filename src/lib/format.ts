import type { OrderStatus } from "./filters";

const TIME_ZONE = "Europe/Lisbon";

const timeFormat = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const dayFormat = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const isoInLisbon = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD
const integer = new Intl.NumberFormat("pt-PT");
const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const unitPriceEur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pendente: "Pendente",
  em_preparacao: "Em preparação",
  enviada: "Enviada",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

// "10:35"
export function formatTime(value: string | Date): string {
  return timeFormat.format(new Date(value));
}

// "14/09/2026, 08:42"
export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(new Date(value));
}

// Date of a timestamp, in Lisbon: "14/09/2026"
export function formatDay(value: string | Date): string {
  return dayFormat.format(new Date(value));
}

// "2026-09-21" → "21/09/2026" (plain string: no timezone shift)
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

// The day of a timestamp in Lisbon, "YYYY-MM-DD"
export function isoDay(value: string | Date): string {
  return isoInLisbon.format(new Date(value));
}

// Today's date in Lisbon, "YYYY-MM-DD"
export function todayIso(): string {
  return isoDay(new Date());
}

// "1200 un", "30 par" (no unit when the code isn't in the catalog)
export function formatQuantity(quantity: number, unit: string | null): string {
  return unit ? `${integer.format(quantity)} ${unit}` : integer.format(quantity);
}

// "134,80 €"
export function formatEur(value: number): string {
  return eur.format(value);
}

// Catalog prices have up to 3 decimals: "0,031 €"
export function formatUnitPrice(value: number): string {
  return unitPriceEur.format(value);
}
