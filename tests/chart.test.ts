import { describe, expect, it } from "vitest";
import { chartRange, columnCount, MAX_CHART_COLUMNS } from "../src/lib/stats";

describe("columnCount", () => {
  it("counts days, inclusive", () => {
    expect(columnCount("2026-09-14", "2026-09-16", "dia")).toBe(3);
    expect(columnCount("2026-09-01", "2026-09-30", "dia")).toBe(30);
  });

  it("counts weeks starting on Monday", () => {
    // 2026-09-14 is a Monday, 2026-09-20 a Sunday: same week
    expect(columnCount("2026-09-14", "2026-09-20", "semana")).toBe(1);
    expect(columnCount("2026-09-20", "2026-09-21", "semana")).toBe(2);
  });

  it("counts months and years across year boundaries", () => {
    expect(columnCount("2025-11-30", "2026-02-01", "mes")).toBe(4);
    expect(columnCount("2000-01-01", "2026-09-26", "ano")).toBe(27);
  });

  it("gives 0 for an inverted or invalid period", () => {
    expect(columnCount("2026-10-01", "2026-09-01", "dia")).toBe(0);
    expect(columnCount("2026-13-45", "2026-09-01", "mes")).toBe(0);
  });
});

describe("chartRange", () => {
  it("fits at exactly the maximum", () => {
    expect(MAX_CHART_COLUMNS).toBe(30);
    expect(chartRange("2026-09-01", "2026-09-30", "dia")).toMatchObject({ columns: 30, fits: true, alternatives: [] });
  });

  it("suggests the groupings that fit when there are too many columns", () => {
    expect(chartRange("2026-01-01", "2026-09-26", "dia")).toMatchObject({
      columns: 269,
      fits: false,
      alternatives: ["mes", "ano"], // 39 weeks don't fit either
    });
  });

  it("suggests nothing when even years don't fit", () => {
    expect(chartRange("1990-01-01", "2026-09-26", "mes")).toMatchObject({ fits: false, alternatives: [] });
  });
});
