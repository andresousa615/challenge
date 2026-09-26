import { describe, expect, it } from "vitest";
import {
  decideCompany,
  isGenericDomain,
  normalizeCompanyName,
  type Company,
} from "../src/lib/companies";

describe("normalizeCompanyName", () => {
  it("ignores case, accents, punctuation, spaces and legal suffixes", () => {
    expect(normalizeCompanyName("Construções Vale do Ave, Lda.")).toBe(
      normalizeCompanyName("construcoes vale do ave"),
    );
    expect(normalizeCompanyName("Ferragens Norte, S.A.")).toBe("ferragensnorte");
    expect(normalizeCompanyName("Ferragens Norte SA")).toBe("ferragensnorte");
    expect(normalizeCompanyName("Pedro Costa Unipessoal, Lda")).toBe("pedrocosta");
  });

  it("does not do fuzzy matching", () => {
    expect(normalizeCompanyName("Carpintaria Sousa")).not.toBe(
      normalizeCompanyName("Carpintaria Sousa Rego"),
    );
  });
});

describe("decideCompany", () => {
  const companies: Company[] = [
    { id: 1, domain: "construcoesvaledoave.pt", name: "Construcoes Vale do Ave, Lda" },
    { id: 2, domain: null, name: "Carpintaria Sousa, Lda" },
  ];

  it("knows the generic domains", () => {
    expect(isGenericDomain("gmail.com")).toBe(true);
    expect(isGenericDomain("SAPO.PT")).toBe(true);
    expect(isGenericDomain("construcoesvaledoave.pt")).toBe(false);
  });

  it("lets the domain win over the signature name", () => {
    expect(decideCompany("rui@construcoesvaledoave.pt", "Outro Nome Qualquer", companies)).toEqual({
      kind: "existing",
      id: 1,
    });
  });

  it("creates a company for a new domain, named from the signature (or the domain)", () => {
    expect(decideCompany("paulo@serralhariamonteiro.pt", "Serralharia Monteiro & Filhos", companies))
      .toEqual({ kind: "create", domain: "serralhariamonteiro.pt", name: "Serralharia Monteiro & Filhos" });
    expect(decideCompany("paulo@serralhariamonteiro.pt", null, companies)).toEqual({
      kind: "create",
      domain: "serralhariamonteiro.pt",
      name: "serralhariamonteiro.pt",
    });
  });

  it("falls back to the normalized name for a generic domain", () => {
    expect(decideCompany("carpintaria.sousa@gmail.com", "Carpintaria Sousa Lda.", companies)).toEqual({
      kind: "existing",
      id: 2,
    });
    expect(decideCompany("x@gmail.com", "Carpintaria Sousa Rego", companies)).toEqual({
      kind: "create",
      domain: null,
      name: "Carpintaria Sousa Rego",
    });
  });

  it("gives no company for a generic domain without a name", () => {
    expect(decideCompany("alguem@hotmail.com", null, companies)).toEqual({ kind: "none" });
  });
});
