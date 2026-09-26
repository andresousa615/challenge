import type postgres from "postgres";

const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "sapo.pt",
  "clix.pt",
  "iol.pt",
]);

const LEGAL_SUFFIXES = new Set(["lda", "sa", "unipessoal"]);

export type Company = { id: number; domain: string | null; name: string };

export type CompanyDecision =
  | { kind: "existing"; id: number }
  | { kind: "create"; domain: string | null; name: string }
  | { kind: "none" };

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}

export function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain.toLowerCase());
}

// "Construções Vale do Ave, Lda." → "construcoesvaledoave"
export function normalizeCompanyName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\bs\.\s*a\b\.?/g, " sa ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join("");
}

// Pure decision (section H). When in doubt, create a duplicate rather than merge.
export function decideCompany(
  fromEmail: string,
  companyName: string | null,
  candidates: Company[],
): CompanyDecision {
  const domain = emailDomain(fromEmail);

  if (!isGenericDomain(domain)) {
    // The domain wins over the signature name.
    const match = candidates.find((c) => c.domain === domain);
    return match
      ? { kind: "existing", id: match.id }
      : { kind: "create", domain, name: companyName ?? domain };
  }

  if (!companyName) return { kind: "none" };

  const normalized = normalizeCompanyName(companyName);
  const match = candidates.find(
    (c) => c.domain === null && normalizeCompanyName(c.name) === normalized,
  );
  return match
    ? { kind: "existing", id: match.id }
    : { kind: "create", domain: null, name: companyName };
}

// Runs inside the sync transaction. Returns the company id, or null (generic domain, no name).
export async function resolveCompany(
  sql: postgres.TransactionSql,
  fromEmail: string,
  companyName: string | null,
): Promise<number | null> {
  const domain = emailDomain(fromEmail);
  const candidates = await sql<Company[]>`
    SELECT id, domain, name FROM companies
    WHERE domain = ${domain} OR domain IS NULL
  `;

  const decision = decideCompany(fromEmail, companyName, candidates);
  if (decision.kind === "none") return null;
  if (decision.kind === "existing") return decision.id;

  const [created] = await sql<{ id: number }[]>`
    INSERT INTO companies (domain, name)
    VALUES (${decision.domain}, ${decision.name})
    RETURNING id
  `;
  return created.id;
}
