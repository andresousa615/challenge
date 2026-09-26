"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatEur } from "@/lib/format";
import type { Grouping, Metric, Stats } from "@/lib/stats";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// bucket = "YYYY-MM-DD", the first day of the day/week/month/year
function bucketLabel(bucket: string, grouping: Grouping, long = false): string {
  const [y, m, d] = bucket.split("-");
  switch (grouping) {
    case "dia":
      return long ? `${d}/${m}/${y}` : `${d}/${m}`;
    case "semana":
      return long ? `Semana de ${d}/${m}/${y}` : `${d}/${m}`;
    case "mes":
      return `${MONTHS[Number(m) - 1]} ${y}`;
    case "ano":
      return y;
  }
}

export function OrdersChart({
  series,
  grouping,
  metric,
}: {
  series: Stats["series"];
  grouping: Grouping;
  metric: Metric;
}) {
  const key = metric === "valor" ? "value" : "orders";
  const config = {
    [key]: { label: metric === "valor" ? "Valor" : "Encomendas", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={series} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickFormatter={(b: string) => bucketLabel(b, grouping)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          allowDecimals={metric === "valor"}
          width={metric === "valor" ? 72 : 32}
          tickFormatter={(v: number) => (metric === "valor" ? formatEur(v) : String(v))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => bucketLabel(String(payload?.[0]?.payload?.bucket ?? ""), grouping, true)}
              formatter={(value) => (
                <span>{metric === "valor" ? formatEur(Number(value)) : `${value} encomenda(s)`}</span>
              )}
            />
          }
        />
        <Bar dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
