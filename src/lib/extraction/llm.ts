import { z } from "zod";
import type { CatalogProduct } from "../catalog";
import type { Config } from "../config";
import type { EmailInput, Extraction } from "./types";

// Off by default: only runs when LLM_ENABLED=true and LLM_API_KEY is set (see config.ts).

const ExtractionSchema = z.strictObject({
  contact: z.string().nullable(),
  companyName: z.string().nullable(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  lines: z.array(
    z.strictObject({
      reference: z.string().min(1),
      quantity: z.number().int().positive().nullable(),
    }),
  ),
});

export type LlmDeps = {
  config: Config["llm"];
  fetchFn?: typeof fetch; // injected in tests (stub): nothing is sent to a real provider
};

type Message = { role: "system" | "user" | "assistant"; content: string };

const TIMEOUT_MS = 30_000;

function systemPrompt(catalog: Pick<CatalogProduct, "reference" | "description" | "unit">[]): string {
  return [
    "És um assistente que lê emails de encomendas enviados à Ferrapex, um distribuidor de ferragens em Portugal.",
    "Extrai do email: o contacto (nome da pessoa), o nome da empresa cliente, a data de entrega pretendida e as linhas da encomenda.",
    "Regras:",
    "- Usa apenas referências que existem no catálogo abaixo. Se um produto não corresponder a nenhuma, mantém o texto tal como está escrito.",
    "- A quantidade é um número inteiro na unidade do catálogo; se não for indicada, usa null.",
    "- A data é no formato YYYY-MM-DD; se não houver data, usa null.",
    "- Responde apenas com JSON no formato pedido.",
    "",
    "Catálogo (referência | descrição | unidade):",
    ...catalog.map((c) => `${c.reference} | ${c.description} | ${c.unit}`),
  ].join("\n");
}

async function callLlm(messages: Message[], deps: LlmDeps): Promise<string> {
  const { baseUrl, model, apiKey } = deps.config;
  const res = await (deps.fetchFn ?? fetch)(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: "extraction", schema: z.toJSONSchema(ExtractionSchema) },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM response has no message content");
  return content;
}

// Returns null on failure (the caller keeps the regex result). One retry, with the error.
export async function extractWithLlm(
  email: Pick<EmailInput, "body">,
  catalog: Pick<CatalogProduct, "reference" | "description" | "unit">[],
  hints: Extraction,
  deps: LlmDeps,
): Promise<Extraction | null> {
  if (!deps.config.enabled) return null;

  const messages: Message[] = [
    { role: "system", content: systemPrompt(catalog) },
    {
      role: "user",
      content: `Email:\n${email.body}\n\nLeitura automática (pode estar incompleta ou errada):\n${JSON.stringify(hints)}`,
    },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let content: string;
    try {
      content = await callLlm(messages, deps);
    } catch (err) {
      console.error(`LLM call failed (attempt ${attempt})`, err);
      continue;
    }

    let problem: string;
    try {
      const parsed = ExtractionSchema.safeParse(JSON.parse(content));
      if (parsed.success) return parsed.data;
      problem = z.prettifyError(parsed.error);
    } catch {
      problem = "a resposta não é JSON válido";
    }
    console.error(`LLM returned invalid output (attempt ${attempt}): ${problem}`);
    messages.push(
      { role: "assistant", content },
      { role: "user", content: `A resposta não é válida: ${problem}. Responde de novo apenas com o JSON corrigido.` },
    );
  }
  return null;
}
