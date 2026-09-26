import type { CatalogProduct } from "../catalog";
import { getConfig } from "../config";
import { extractWithLlm, type LlmDeps } from "./llm";
import { extractWithRegex } from "./regex";
import type { EmailInput, Extraction } from "./types";

// Incomplete = no lines, an unknown code, no date, or no company name.
export function isIncomplete(e: Extraction, catalog: Pick<CatalogProduct, "reference">[]): boolean {
  const known = new Set(catalog.map((c) => c.reference));
  return (
    e.lines.length === 0 ||
    e.lines.some((l) => !known.has(l.reference)) ||
    e.requestedDate === null ||
    e.companyName === null
  );
}

// Regex first; the LLM only when enabled and the regex result is incomplete.
// A valid LLM result replaces the regex one ("the LLM decides"); on failure, keep the regex.
export async function extract(
  email: EmailInput,
  catalog: CatalogProduct[],
  deps: LlmDeps = { config: getConfig().llm },
): Promise<Extraction> {
  const regex = extractWithRegex(email, catalog);
  if (!deps.config.enabled || !isIncomplete(regex, catalog)) return regex;
  return (await extractWithLlm(email, catalog, regex, deps)) ?? regex;
}
