import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseCatalogCsv } from "../src/lib/catalog";
import { extract } from "../src/lib/extraction";
import type { LlmDeps } from "../src/lib/extraction/llm";
import type { EmailInput } from "../src/lib/extraction/types";

const catalog = parseCatalogCsv(readFileSync(path.join(__dirname, "fixtures", "catalog.csv"), "utf8"));
const emails: EmailInput[] = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "emails.json"), "utf8"));

// Free text: the regex finds no lines, no date and no signature → incomplete.
const freeText: EmailInput = {
  id: "t-1",
  from: "ana@exemplo.pt",
  received_at: "2026-09-20T10:00:00+01:00",
  body: "Olá, precisava de mil parafusos de aglomerado de 40 para a próxima sexta. Obrigada",
};

const llmResult = {
  contact: "Ana",
  companyName: null,
  requestedDate: "2026-10-02",
  lines: [{ reference: "PRF-AGL-40", quantity: 1000 }],
};

// Stub of an OpenAI-compatible /chat/completions endpoint: nothing leaves the test.
function stubFetch(...contents: string[]) {
  const fn = vi.fn(async () => {
    const content = contents.shift() ?? "{}";
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  });
  return fn as unknown as typeof fetch & typeof fn;
}

const enabled = (fetchFn: typeof fetch): LlmDeps => ({
  config: { enabled: true, baseUrl: "http://llm.stub", model: "stub", apiKey: "stub" },
  fetchFn,
});

describe("extract with the LLM module", () => {
  it("never calls the LLM when it is disabled", async () => {
    const fetchFn = stubFetch(JSON.stringify(llmResult));
    const result = await extract(freeText, catalog, {
      config: { enabled: false, baseUrl: "", model: "", apiKey: null },
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.lines).toEqual([]);
  });

  it("does not call the LLM when the regex result is complete", async () => {
    const fetchFn = stubFetch(JSON.stringify(llmResult));
    const result = await extract(emails[0], catalog, enabled(fetchFn));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.lines).toHaveLength(3);
  });

  it("uses a valid LLM result for an incomplete email", async () => {
    const fetchFn = stubFetch(JSON.stringify(llmResult));
    expect(await extract(freeText, catalog, enabled(fetchFn))).toEqual(llmResult);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries once after invalid output, then uses the corrected result", async () => {
    const fetchFn = stubFetch('{"lines": "not an array"}', JSON.stringify(llmResult));
    expect(await extract(freeText, catalog, enabled(fetchFn))).toEqual(llmResult);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("falls back to the regex result after two invalid outputs", async () => {
    const fetchFn = stubFetch("not json", '{"contact": 5}');
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await extract(freeText, catalog, enabled(fetchFn));
    errors.mockRestore();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ contact: null, companyName: null, requestedDate: null, lines: [] });
  });
});
