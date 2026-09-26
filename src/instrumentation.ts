export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Guard so the scheduler is never registered twice.
  const g = globalThis as unknown as { __ferrapexScheduler?: boolean };
  if (g.__ferrapexScheduler) return;
  g.__ferrapexScheduler = true;

  const { getConfig } = await import("./lib/config");
  const { runSchema } = await import("./lib/db");
  const { runSync } = await import("./lib/sync");

  await runSchema();
  void runSync("auto");
  setInterval(() => void runSync("auto"), getConfig().syncIntervalMinutes * 60_000);
}
