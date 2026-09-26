import { parse } from "csv-parse/sync";
import { getDb } from "./db";
import { AppError } from "./errors";
import { fetchCatalogCsv } from "./ferrapex-api";

export type CatalogProduct = {
  reference: string;
  description: string;
  family: string;
  unit: string;
  priceEur: number;
};

const COLUMNS = ["referencia", "descricao", "familia", "unidade", "preco_eur"] as const;

// CSV: referencia,descricao,familia,unidade,preco_eur (decimal point).
export function parseCatalogCsv(csv: string): CatalogProduct[] {
  let records: Record<string, string>[];
  try {
    records = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    throw new AppError("bad_response", { cause: err });
  }

  if (records.length === 0) throw new AppError("bad_response");

  return records.map((r) => {
    const priceEur = Number(r.preco_eur);
    if (COLUMNS.some((c) => !r[c]) || !Number.isFinite(priceEur)) {
      console.error("Catalog CSV: invalid row", r);
      throw new AppError("bad_response");
    }
    return {
      reference: r.referencia,
      description: r.descricao,
      family: r.familia,
      unit: r.unidade,
      priceEur,
    };
  });
}

// Upsert only: products are never deleted. Products missing from the API catalog are
// marked inactive (no longer offered, no price for new lines); they come back if they reappear.
export async function upsertCatalog(products: CatalogProduct[]): Promise<void> {
  const sql = getDb();
  const rows = products.map((p) => ({
    reference: p.reference,
    description: p.description,
    family: p.family,
    unit: p.unit,
    price_eur: p.priceEur,
  }));
  await sql`
    INSERT INTO catalog_products ${sql(rows)}
    ON CONFLICT (reference) DO UPDATE SET
      description = EXCLUDED.description,
      family      = EXCLUDED.family,
      unit        = EXCLUDED.unit,
      price_eur   = EXCLUDED.price_eur,
      active      = true
  `;
  await sql`
    UPDATE catalog_products SET active = false
    WHERE active AND reference <> ALL(${products.map((p) => p.reference)}::text[])
  `;
}

export async function syncCatalog(): Promise<CatalogProduct[]> {
  const products = parseCatalogCsv(await fetchCatalogCsv());
  await upsertCatalog(products);
  return products;
}

export type CatalogEntry = CatalogProduct & { active: boolean };

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const rows = await getDb()`
    SELECT reference, description, family, unit, price_eur, active
    FROM catalog_products
    ORDER BY reference
  `;
  return rows.map((r) => ({
    reference: r.reference,
    description: r.description,
    family: r.family,
    unit: r.unit,
    priceEur: Number(r.price_eur),
    active: r.active,
  }));
}
