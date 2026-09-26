import { syncCatalog } from "./catalog";
import { getDb } from "./db";
import { AppError, errorMessage, failedEmailsMessage } from "./errors";
import { extract } from "./extraction";
import { fetchEmails } from "./ferrapex-api";
import { resolveCompany } from "./companies";
import { existingEmailIds, insertOrder } from "./orders";

export type SyncStatus = {
  at: string; // ISO timestamp
  ok: boolean;
  newOrders: number;
  message: string | null;
};

// In memory (lost on restart: acceptable). On globalThis so every bundle sees the same state.
const g = globalThis as unknown as {
  __ferrapexSync?: boolean;
  __ferrapexSyncStatus?: SyncStatus;
  __ferrapexRetryAt?: Date;
};

export function getSyncStatus(): SyncStatus | null {
  return g.__ferrapexSyncStatus ?? null;
}

export async function runSync(trigger: "manual" | "auto"): Promise<SyncStatus> {
  if (g.__ferrapexSync) {
    return { at: new Date().toISOString(), ok: false, newOrders: 0, message: errorMessage(new AppError("already_running")) };
  }
  // After a 429 with Retry-After, auto syncs wait until then.
  if (trigger === "auto" && g.__ferrapexRetryAt && g.__ferrapexRetryAt > new Date()) {
    return getSyncStatus()!;
  }

  g.__ferrapexSync = true;
  let status: SyncStatus;
  try {
    status = await syncEmails();
  } catch (err) {
    const error = toAppError(err);
    if (error.kind === "rate_limited") g.__ferrapexRetryAt = error.retryAt ?? undefined;
    status = { at: new Date().toISOString(), ok: false, newOrders: 0, message: errorMessage(error) };
  } finally {
    g.__ferrapexSync = false;
  }
  g.__ferrapexSyncStatus = status;
  return status;
}

async function syncEmails(): Promise<SyncStatus> {
  const catalog = await syncCatalog();
  const emails = await fetchEmails();
  const saved = await existingEmailIds();
  const sql = getDb();

  let newOrders = 0;
  const failed: string[] = [];

  for (const email of emails) {
    if (saved.has(email.id)) continue;
    // One bad email never stops the others.
    try {
      const extraction = await extract(email, catalog);
      const orderId = await sql.begin(async (tx) => {
        const companyId = await resolveCompany(tx, email.from, extraction.companyName);
        return insertOrder(tx, {
          emailId: email.id,
          companyId,
          contact: extraction.contact,
          customerEmail: email.from,
          receivedAt: email.received_at,
          requestedDate: extraction.requestedDate,
          emailBody: email.body,
          lines: extraction.lines,
        });
      });
      if (orderId !== null) newOrders++;
    } catch (err) {
      console.error(`Sync: email ${email.id} not saved`, err);
      failed.push(email.id);
    }
  }

  return {
    at: new Date().toISOString(),
    ok: failed.length === 0,
    newOrders,
    message: failed.length ? failedEmailsMessage(failed) : null,
  };
}

// API and CSV failures are already AppErrors; anything else here comes from the database.
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  console.error("Sync failed", err);
  return new AppError("db_unavailable", { cause: err });
}
