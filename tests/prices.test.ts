import { describe, expect, it } from "vitest";
import { keptSnapshots, nextStatusDates, type StatusDates } from "../src/lib/orders";

// Editing an order must not change what lines already on it were saved with.
describe("keptSnapshots", () => {
  const previous = [
    // saved a year ago at 20 €, with the name and unit of that time
    { reference: "PRF-AGL-40", unitPrice: "20.000", description: "Parafuso antigo", unit: "un" },
    // unknown code: nothing was saved
    { reference: "PRF-AGL-45", unitPrice: null, description: null, unit: null },
  ];

  it("keeps price, name and unit for a product that was already on the order", () => {
    expect(keptSnapshots(["PRF-AGL-40"], previous)).toEqual([
      { unitPrice: "20.000", description: "Parafuso antigo", unit: "un" },
    ]);
  });

  it("gives null (→ the catalog now) for a new product", () => {
    expect(keptSnapshots(["PRF-AGL-40", "BCH-NYL-08"], previous)[1]).toBeNull();
  });

  it("gives null for a corrected or still-unknown code", () => {
    expect(keptSnapshots(["PRF-AGL-60", "PRF-AGL-45"], previous)).toEqual([null, null]);
  });
});

describe("nextStatusDates", () => {
  const none: StatusDates = { em_preparacao: null, enviada: null, entregue: null, cancelada: null };
  const today = "2026-09-26";

  it("dates the stage that is entered", () => {
    expect(nextStatusDates(none, "em_preparacao", today)).toEqual({ ...none, em_preparacao: today });
  });

  it("keeps an existing date when the stage is entered again", () => {
    const d = { ...none, em_preparacao: "2026-09-20" };
    expect(nextStatusDates(d, "em_preparacao", today).em_preparacao).toBe("2026-09-20");
  });

  it("leaves skipped stages empty", () => {
    expect(nextStatusDates(none, "entregue", today)).toEqual({ ...none, entregue: today });
  });

  it("clears later stages when going back (a mistake is undone)", () => {
    const d = { ...none, em_preparacao: "2026-09-20", enviada: "2026-09-22", entregue: "2026-09-26" };
    expect(nextStatusDates(d, "enviada", today)).toEqual({ ...d, entregue: null });
    expect(nextStatusDates(d, "pendente", today)).toEqual(none);
  });

  it("keeps the progress when cancelling, and clears the cancellation when resumed", () => {
    const d = { ...none, em_preparacao: "2026-09-20" };
    const cancelled = nextStatusDates(d, "cancelada", today);
    expect(cancelled).toEqual({ ...d, cancelada: today });
    expect(nextStatusDates(cancelled, "em_preparacao", today)).toEqual(d);
  });
});
