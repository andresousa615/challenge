import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCatalogCsv } from "../src/lib/catalog";
import { extractWithRegex } from "../src/lib/extraction/regex";
import type { EmailInput } from "../src/lib/extraction/types";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const catalog = parseCatalogCsv(fixture("catalog.csv"));
const emails: EmailInput[] = JSON.parse(fixture("emails.json"));

const extract = (body: string) => extractWithRegex({ body }, catalog);
const linesOf = (body: string) => extract(body).lines;

describe("the 3 real emails", () => {
  const byId = (id: string) => extractWithRegex(emails.find((e) => e.id === id)!, catalog);

  it("1-01", () => {
    expect(byId("1-01")).toEqual({
      contact: "Rui Amorim",
      companyName: "Construcoes Vale do Ave, Lda",
      requestedDate: "2026-09-21",
      lines: [
        { reference: "PRF-AGL-40", quantity: 1200 },
        { reference: "BCH-NYL-08", quantity: 800 },
        { reference: "SIL-ACE-280", quantity: 24 },
      ],
    });
  });

  it("1-02", () => {
    expect(byId("1-02")).toEqual({
      contact: "Paulo Monteiro",
      companyName: "Serralharia Monteiro & Filhos",
      requestedDate: "2026-09-18",
      lines: [
        { reference: "DSC-COR-125", quantity: 100 },
        { reference: "DSC-DES-125", quantity: 25 },
        { reference: "EPI-OCU-CLR", quantity: 6 },
      ],
    });
  });

  it("1-03", () => {
    expect(byId("1-03")).toEqual({
      contact: "Helder Rego",
      companyName: "Carpintaria Sousa Rego, Lda",
      requestedDate: "2026-09-25",
      lines: [
        { reference: "DOB-080-ZNC", quantity: 30 },
        { reference: "PRF-AGL-60", quantity: 1000 },
        { reference: "FER-FIT-8", quantity: 2 },
      ],
    });
  });
});

describe("codes", () => {
  it("matches codes without hyphens, with spaces, with underscores and in lowercase", () => {
    expect(linesOf("PRFAGL40 | 10\nPRF AGL 40 | 20\nprf-agl-40 | 30\nPRF_AGL_40 | 40")).toEqual([
      { reference: "PRF-AGL-40", quantity: 10 },
      { reference: "PRF-AGL-40", quantity: 20 },
      { reference: "PRF-AGL-40", quantity: 30 },
      { reference: "PRF-AGL-40", quantity: 40 },
    ]);
  });

  it("reads FER-FIT-8 | 2 as quantity 2, not 82", () => {
    expect(linesOf("FER-FIT-8 | 2")).toEqual([{ reference: "FER-FIT-8", quantity: 2 }]);
  });

  it("does not match a known code followed by more digits", () => {
    expect(linesOf("FERFIT82")).toEqual([]);
  });

  it("keeps an unknown code (typo) as written", () => {
    expect(linesOf("PRF-AGL-45 | 1200")).toEqual([{ reference: "PRF-AGL-45", quantity: 1200 }]);
  });

  it("keeps a text | number line with no code", () => {
    expect(linesOf("texto | 5")).toEqual([{ reference: "texto", quantity: 5 }]);
  });

  it("keeps several codes on the same line, in order", () => {
    expect(linesOf("BCH-NYL-08 x 800, PRF-AGL-40 x 1200")).toEqual([
      { reference: "BCH-NYL-08", quantity: 800 },
      { reference: "PRF-AGL-40", quantity: 1200 },
    ]);
  });
});

describe("quantities", () => {
  it("reads a quantity before the code", () => {
    expect(linesOf("1200x PRF-AGL-40")).toEqual([{ reference: "PRF-AGL-40", quantity: 1200 }]);
    expect(linesOf("30 pares de DOB-080-ZNC")).toEqual([{ reference: "DOB-080-ZNC", quantity: 30 }]);
  });

  it("reads thousands separators: 1 200 and 1.200 → 1200", () => {
    expect(linesOf("PRF-AGL-40 | 1 200\nPRF-AGL-60 | 1.200")).toEqual([
      { reference: "PRF-AGL-40", quantity: 1200 },
      { reference: "PRF-AGL-60", quantity: 1200 },
    ]);
  });

  it("gives null when there is no quantity", () => {
    expect(linesOf("Queria também PRF-AGL-40, por favor")).toEqual([
      { reference: "PRF-AGL-40", quantity: null },
    ]);
  });

  it("gives null for an absurdly large quantity (the line is kept for review)", () => {
    expect(linesOf("PRF-AGL-40 | 99999999999")).toEqual([{ reference: "PRF-AGL-40", quantity: null }]);
    expect(linesOf("PRF-AGL-40 | 9999999")).toEqual([{ reference: "PRF-AGL-40", quantity: 9999999 }]);
  });

  it("gives null for a decimal comma", () => {
    expect(linesOf("SIL-ACE-280 | 1,5")).toEqual([{ reference: "SIL-ACE-280", quantity: null }]);
  });
});

describe("requested date", () => {
  it("converts DD/MM/YYYY, DD-MM-YYYY and DD.MM.YYYY to ISO", () => {
    expect(extract("Entrega a 21/09/2026").requestedDate).toBe("2026-09-21");
    expect(extract("Entrega a 21-09-2026").requestedDate).toBe("2026-09-21");
    expect(extract("Entrega a 21.09.2026").requestedDate).toBe("2026-09-21");
  });

  it("skips invalid dates and gives null when there is none", () => {
    expect(extract("Entrega a 31/02/2026, ou 2026-03-02").requestedDate).toBe("2026-03-02");
    expect(extract("Entrega o mais breve possível").requestedDate).toBeNull();
  });
});

describe("signature", () => {
  it("is read bottom-up despite the greeting ending with a comma", () => {
    const e = extract("Bom dia,\n\nPRF-AGL-40 | 10\n\nCumprimentos,\nAna Silva\nFerragens Silva, Lda\n");
    expect(e.contact).toBe("Ana Silva");
    expect(e.companyName).toBe("Ferragens Silva, Lda");
  });

  it("gives nulls when there is no farewell", () => {
    const e = extract("Bom dia,\n\nPRF-AGL-40 | 10\nAna Silva\nFerragens Silva, Lda\n");
    expect(e.contact).toBeNull();
    expect(e.companyName).toBeNull();
  });
});
