import { getConfig } from "./config";
import { AppError } from "./errors";

export type ApiEmail = {
  id: string;
  from: string;
  received_at: string;
  body: string;
};

const TIMEOUT_MS = 15_000;

async function request(path: string): Promise<Response> {
  const { ferrapexApiUrl, ferrapexApiKey } = getConfig();
  if (!ferrapexApiUrl) throw new AppError("missing_url");
  if (!ferrapexApiKey) throw new AppError("missing_key");

  let res: Response;
  try {
    res = await fetch(`${ferrapexApiUrl}${path}`, {
      headers: { Authorization: `Bearer ${ferrapexApiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`Ferrapex API ${path}: request failed`, err);
    throw new AppError("unreachable", { cause: err });
  }
  if (res.ok) return res;

  // Error bodies look like {"detail": "..."} (Portuguese); log them raw.
  const body = await res.text().catch(() => "");
  console.error(`Ferrapex API ${path}: HTTP ${res.status} ${body}`);

  if (res.status === 401) throw new AppError("unauthorized");
  if (res.status === 429) {
    throw new AppError("rate_limited", { retryAt: parseRetryAfter(res.headers.get("retry-after")) });
  }
  if (res.status >= 500) throw new AppError("unreachable");
  throw new AppError("bad_response");
}

// Retry-After is either a number of seconds or an HTTP date.
function parseRetryAfter(value: string | null): Date | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return new Date(Date.now() + seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function fetchCatalogCsv(): Promise<string> {
  const res = await request("/catalog");
  try {
    return await res.text();
  } catch (err) {
    throw new AppError("unreachable", { cause: err });
  }
}

export async function fetchEmails(): Promise<ApiEmail[]> {
  const res = await request("/emails");
  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    throw new AppError("bad_response", { cause: err });
  }
  if (!Array.isArray(data) || !data.every(isApiEmail)) {
    console.error("Ferrapex API /emails: unexpected shape", data);
    throw new AppError("bad_response");
  }
  return data.map(({ id, from, received_at, body }) => ({ id, from, received_at, body }));
}

function isApiEmail(value: unknown): value is ApiEmail {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.from === "string" &&
    typeof v.received_at === "string" &&
    typeof v.body === "string"
  );
}
