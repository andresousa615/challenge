export type Config = {
  databaseUrl: string;
  ferrapexApiUrl: string | null;
  ferrapexApiKey: string | null;
  syncIntervalMinutes: number;
  llm: {
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKey: string | null;
  };
};

// Read lazily (not at import time) so `next build` works without runtime env vars.
export function getConfig(): Config {
  const env = process.env;

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const syncIntervalMinutes = Number(env.SYNC_INTERVAL_MINUTES || 5);
  if (!Number.isFinite(syncIntervalMinutes) || syncIntervalMinutes <= 0) {
    throw new Error("SYNC_INTERVAL_MINUTES must be a positive number");
  }

  const llmApiKey = env.LLM_API_KEY?.trim() || null;

  return {
    databaseUrl,
    ferrapexApiUrl: env.FERRAPEX_API_URL?.trim().replace(/\/+$/, "") || null,
    ferrapexApiKey: env.FERRAPEX_API_KEY?.trim() || null,
    syncIntervalMinutes,
    llm: {
      // A key alone does not enable the LLM: LLM_ENABLED must be "true" too.
      enabled: env.LLM_ENABLED === "true" && llmApiKey !== null,
      baseUrl: (env.LLM_BASE_URL || "").replace(/\/+$/, ""),
      model: env.LLM_MODEL || "",
      apiKey: llmApiKey,
    },
  };
}
