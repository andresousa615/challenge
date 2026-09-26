"use server";

import { revalidatePath } from "next/cache";
import { STATUSES, type OrderStatus } from "@/lib/filters";
import { todayIso } from "@/lib/format";
import {
  getOrderDates,
  saveOrderEdits as saveOrderEditsInDb,
  setStatusDate as setStatusDateInDb,
  updateStatus as updateStatusInDb,
  type Milestone,
  type OrderEdits,
} from "@/lib/orders";
import { MAX_QUANTITY } from "@/lib/extraction/types";
import { runSync, type SyncStatus } from "@/lib/sync";

export async function syncNow(): Promise<SyncStatus> {
  const status = await runSync("manual");
  revalidatePath("/encomendas");
  return status;
}

export async function updateStatus(orderId: number, status: OrderStatus): Promise<void> {
  if (!STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
  await updateStatusInDb(orderId, status, todayIso());
  revalidatePath("/encomendas", "layout");
}

const MILESTONES: Milestone[] = ["em_preparacao", "enviada", "entregue", "cancelada"];

// Corrects when a stage was reached. Only for stages already reached; the date can't be in
// the future nor before the order was received. Returns an error message, or null when saved.
export async function setStatusDate(orderId: number, milestone: Milestone, date: string): Promise<string | null> {
  if (!MILESTONES.includes(milestone)) return "Etapa inválida.";
  if (!isValidIsoDate(date)) return "A data não é válida.";
  const order = await getOrderDates(orderId);
  if (!order) return "Encomenda não encontrada.";
  if (!order.dates[milestone]) return "Esta etapa ainda não aconteceu.";
  if (date > todayIso()) return "A data não pode ser no futuro.";
  if (date < order.receivedDay) return "A data não pode ser anterior à receção da encomenda.";
  await setStatusDateInDb(orderId, milestone, date);
  revalidatePath("/encomendas", "layout");
  return null;
}

export type EditInput = {
  contact: string;
  requestedDate: string;
  lines: { reference: string; quantity: string }[];
};

// Returns an error message in Portuguese, or null when saved.
export async function saveOrderEdits(orderId: number, input: EditInput): Promise<string | null> {
  const result = validate(input);
  if (typeof result === "string") return result;
  await saveOrderEditsInDb(orderId, result);
  revalidatePath("/encomendas", "layout");
  return null;
}

function validate(input: EditInput): OrderEdits | string {
  const requestedDate = input.requestedDate.trim();
  if (requestedDate && !isValidIsoDate(requestedDate)) return "A data pretendida não é válida.";

  const lines: OrderEdits["lines"] = [];
  for (const [i, line] of input.lines.entries()) {
    const reference = line.reference.trim().toUpperCase();
    const digits = line.quantity.trim();
    const quantity = Number(digits);
    if (!reference) return `Linha ${i + 1}: falta a referência.`;
    if (!/^\d+$/.test(digits) || quantity <= 0) {
      return `Linha ${i + 1} (${reference}): a quantidade tem de ser um número inteiro maior que zero.`;
    }
    if (quantity > MAX_QUANTITY) {
      return `Linha ${i + 1} (${reference}): a quantidade é demasiado grande (máximo ${MAX_QUANTITY.toLocaleString("pt-PT")}).`;
    }
    lines.push({ reference, quantity });
  }

  return { contact: input.contact.trim() || null, requestedDate: requestedDate || null, lines };
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
