import type { CatalogProduct } from "../catalog";
import { MAX_QUANTITY, type EmailInput, type ExtractedLine, type Extraction } from "./types";

// Pure: no DB, no network. See implementation-plan.md section F for the rules.

// A space or dot inside a number only as a thousands separator: "1 200", "1.200".
const NUMBER = String.raw`\d{1,3}(?:[ .]\d{3})+|\d+`;
// Not followed by a decimal part ("1,5" is not a quantity).
const NUMBER_END = String.raw`(?![.,]?\d)`;
const QTY_RIGHT = new RegExp(String.raw`^\s*(?:[|:=x×\-–]\s*)?(${NUMBER})${NUMBER_END}`, "i");
const QTY_LEFT = new RegExp(
  String.raw`(?<![\d.,])(${NUMBER})\s*(?:x|×|un\.?|unid\.?|unidades?|pares?|pcs)?\s*(?:de\s+)?$`,
  "i",
);
const UNKNOWN_CODE = /(?<![A-Za-z0-9])[A-Za-z]{2,4}(?:-[A-Za-z0-9]{1,4}){1,2}(?![A-Za-z0-9])/g;
const TEXT_PIPE_NUMBER = new RegExp(String.raw`^(.+?)\s*\|\s*(${NUMBER})${NUMBER_END}\s*$`);
const DATE =
  /(?<!\d)(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})([/.-])(\d{1,2})\5(\d{4}))(?!\d)/g;

const normalizeCode = (code: string) => code.replace(/[\s\-_.]/g, "").toUpperCase();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type CodeMatcher = { regex: RegExp; canonical: Map<string, string> };

function buildCodeMatcher(catalog: Pick<CatalogProduct, "reference">[]): CodeMatcher {
  const canonical = new Map<string, string>();
  for (const { reference } of catalog) canonical.set(normalizeCode(reference), reference);

  const alternatives = [...canonical.values()]
    .sort((a, b) => normalizeCode(b).length - normalizeCode(a).length)
    .map((ref) => ref.split(/[\s\-_.]+/).map(escapeRegex).join(String.raw`[\s\-_.]*`));

  // No letter or digit right before or after: "FERFIT82" does not match FER-FIT-8.
  const regex = alternatives.length
    ? new RegExp(`(?<![A-Za-z0-9])(?:${alternatives.join("|")})(?![A-Za-z0-9])`, "gi")
    : /(?!)/g;
  return { regex, canonical };
}

// Out of range (0, or absurdly large) → null, so the line shows "Sem quantidade" for review.
function parseNumber(text: string): number | null {
  const n = Number.parseInt(text.replace(/[ .]/g, ""), 10);
  return n > 0 && n <= MAX_QUANTITY ? n : null;
}

function findQuantity(line: string, start: number, end: number): number | null {
  const right = QTY_RIGHT.exec(line.slice(end));
  if (right) return parseNumber(right[1]);
  const left = QTY_LEFT.exec(line.slice(0, start));
  if (left) return parseNumber(left[1]);
  return null;
}

function extractLines(body: string, matcher: CodeMatcher): ExtractedLine[] {
  const result: ExtractedLine[] = [];

  for (const line of body.split(/\r?\n/)) {
    const found: { index: number; line: ExtractedLine }[] = [];

    // 1. Known codes, stored as the canonical reference.
    let masked = line;
    for (const m of line.matchAll(matcher.regex)) {
      const start = m.index;
      const end = start + m[0].length;
      found.push({
        index: start,
        line: {
          reference: matcher.canonical.get(normalizeCode(m[0]))!,
          quantity: findQuantity(line, start, end),
        },
      });
      masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
    }

    // 3a. Code-shaped tokens that are not in the catalog, kept as written.
    for (const m of masked.matchAll(UNKNOWN_CODE)) {
      const start = m.index;
      const end = start + m[0].length;
      found.push({
        index: start,
        line: { reference: m[0].toUpperCase(), quantity: findQuantity(line, start, end) },
      });
    }

    // 3b. "<text> | <number>" with no code at all.
    if (found.length === 0) {
      const m = TEXT_PIPE_NUMBER.exec(line.trim());
      if (m) found.push({ index: 0, line: { reference: m[1].trim(), quantity: parseNumber(m[2]) } });
    }

    found.sort((a, b) => a.index - b.index);
    result.push(...found.map((f) => f.line));
  }

  return result;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function extractDate(body: string): string | null {
  for (const m of body.matchAll(DATE)) {
    const iso = m[1]
      ? toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]))
      : toIsoDate(Number(m[7]), Number(m[6]), Number(m[4]));
    if (iso) return iso;
  }
  return null;
}

// Read bottom-up: greetings ("Bom dia,") also end with a comma, so top-down fails.
function extractSignature(body: string): { contact: string | null; companyName: string | null } {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3 || !lines[lines.length - 3].endsWith(",")) {
    return { contact: null, companyName: null };
  }
  return { contact: lines[lines.length - 2], companyName: lines[lines.length - 1] };
}

export function extractWithRegex(
  email: Pick<EmailInput, "body">,
  catalog: Pick<CatalogProduct, "reference">[],
): Extraction {
  return {
    ...extractSignature(email.body),
    requestedDate: extractDate(email.body),
    lines: extractLines(email.body, buildCodeMatcher(catalog)),
  };
}
