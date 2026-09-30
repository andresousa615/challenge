import Link from "next/link";
import { ArrowDown, ArrowUpDown } from "lucide-react";
import { LinkRow } from "@/components/link-row";
import { OrdersChart } from "@/components/orders-chart";
import { PageHeader } from "@/components/page-header";
import { ProductCode, ProductName } from "@/components/product-name";
import { SignalBadge } from "@/components/signal";
import { ResumoControls } from "@/components/resumo-controls";
import { ScrollBox } from "@/components/scroll-box";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatEur, formatQuantity, STATUS_LABELS } from "@/lib/format";
import {
  getDueDeliveries,
  getStats,
  MAX_CHART_COLUMNS,
  parseStatsParams,
  type ChartRange,
  type DueDelivery,
  type Grouping,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function toQuery(params: SearchParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) q.set(k, value);
  }
  return q.toString();
}

export default async function ResumoPage({ searchParams }: PageProps<"/resumo">) {
  const raw = await searchParams;
  const params = parseStatsParams(raw);
  const query = toQuery(raw);
  const [stats, due] = await Promise.all([getStats(params), getDueDeliveries()]);

  const sortHref = (key: string, value: string) => {
    const q = new URLSearchParams(query);
    q.set(key, value);
    return `/resumo?${q}`;
  };
  const maxFamily = Math.max(...stats.byFamily.map((f) => f.value), 0);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <PageHeader
        title="Resumo"
        description="Valores ao preço de cada encomenda (o do catálogo quando foi guardada). As encomendas canceladas não contam, exceto em “Por estado”. O período aplica-se à data em que a encomenda foi recebida."
      />

      <section className="rounded-lg border bg-card p-4">
        <ResumoControls key={query} params={params} query={query} />
      </section>

      {/* One strip, not five cards: the numbers belong together. */}
      <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-5 lg:divide-x">
        <Stat label="Encomendas" value={String(stats.orders)} />
        <Stat label="Valor total" value={formatEur(stats.totalValue)} />
        <Stat label="Valor médio por encomenda" value={formatEur(stats.averageValue)} />
        <Stat label="Clientes" value={String(stats.clients)} />
        <Stat
          label="A rever"
          value={String(stats.toReview)}
          hint="Código desconhecido, sem quantidade ou sem produtos"
          attention={stats.toReview > 0}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            {params.metric === "valor" ? "Valor das encomendas" : "Número de encomendas"} por{" "}
            {GROUPING_LABELS[params.grouping]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats.chart ? (
            <Empty />
          ) : !stats.chart.fits ? (
            <TooManyColumns chart={stats.chart} grouping={params.grouping} href={(g) => sortHref("agrupar", g)} />
          ) : (
            <OrdersChart series={stats.series} grouping={params.grouping} metric={params.metric} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Entregas por concluir</CardTitle>
            <CardDescription>
              Ainda não entregues (pendentes, em preparação ou enviadas), atrasadas ou com entrega
              nos próximos 7 dias (independente do período).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {due.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada urgente de momento.</p>
            ) : (
              <ScrollBox>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {due.map((d) => (
                    <LinkRow key={d.id} href={`/encomendas/${d.id}`}>
                      <TableCell>
                        <div>{formatDate(d.requestedDate)}</div>
                        <DueBadge daysLeft={d.daysLeft} />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <Link
                          href={`/encomendas/${d.id}`}
                          className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {d.companyName}
                        </Link>
                      </TableCell>
                      <TableCell>{STATUS_LABELS[d.status]}</TableCell>
                      <TableCell className="text-right">{formatEur(d.value)}</TableCell>
                    </LinkRow>
                  ))}
                </TableBody>
              </Table>
              </ScrollBox>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por estado</CardTitle>
            <CardDescription>Todas as encomendas do período, incluindo canceladas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Encomendas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byStatus.map((s) => (
                  <TableRow key={s.status}>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">{s.orders}</TableCell>
                    <TableCell className="text-right">{formatEur(s.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Melhores clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topClients.length === 0 ? (
              <Empty />
            ) : (
              <ScrollBox>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <SortHead href={sortHref("clientes", "encomendas")} active={params.clientsBy === "encomendas"}>
                      Encomendas
                    </SortHead>
                    <SortHead href={sortHref("clientes", "valor")} active={params.clientsBy === "valor"}>
                      Valor
                    </SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topClients.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="whitespace-normal">{c.name}</TableCell>
                      <TableCell className="text-right">{c.orders}</TableCell>
                      <TableCell className="text-right">{formatEur(c.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </ScrollBox>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos mais vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topProducts.length === 0 ? (
              <Empty />
            ) : (
              <ScrollBox>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <SortHead href={sortHref("produtos", "quantidade")} active={params.productsBy === "quantidade"}>
                      Quantidade
                    </SortHead>
                    <SortHead href={sortHref("produtos", "valor")} active={params.productsBy === "valor"}>
                      Valor
                    </SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topProducts.map((p) => (
                    <TableRow key={p.reference}>
                      <TableCell>
                        <ProductName description={p.description} reference={p.reference} />
                        <ProductCode reference={p.reference} className="block" />
                      </TableCell>
                      <TableCell className="text-right">{formatQuantity(p.quantity, p.unit)}</TableCell>
                      <TableCell className="text-right">{formatEur(p.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </ScrollBox>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas por família de produto</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.byFamily.length === 0 ? (
            <Empty />
          ) : (
            <ScrollBox>
            <ul className="space-y-3">
              {stats.byFamily.map((f) => (
                <li key={f.family} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
                  <span>{f.family}</span>
                  <span className="h-3 rounded bg-muted">
                    <span
                      className="block h-3 rounded bg-(--chart-1)"
                      style={{ width: `${maxFamily ? (f.value / maxFamily) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="text-right">{formatEur(f.value)}</span>
                </li>
              ))}
            </ul>
            </ScrollBox>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  attention,
}: {
  label: string;
  value: string;
  hint?: string;
  attention?: boolean;
}) {
  return (
    <div className={attention ? "bg-signal-soft px-5 py-4 shadow-[inset_0_4px_0_var(--signal)]" : "px-5 py-4"}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={
          attention
            ? "mt-1 text-3xl font-bold text-signal-foreground [font-stretch:80%]"
            : "mt-1 text-3xl font-bold [font-stretch:80%]"
        }
      >
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DueBadge({ daysLeft }: { daysLeft: DueDelivery["daysLeft"] }) {
  if (daysLeft < 0) {
    const days = -daysLeft;
    return <SignalBadge strong>Atrasada {days === 1 ? "1 dia" : `${days} dias`}</SignalBadge>;
  }
  if (daysLeft === 0) return <SignalBadge>Hoje</SignalBadge>;
  return <Badge variant="outline">{daysLeft === 1 ? "Amanhã" : `Em ${daysLeft} dias`}</Badge>;
}

// Numbers sort from highest to lowest; the active column shows ↓.
function SortHead({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  const Arrow = active ? ArrowDown : ArrowUpDown;
  return (
    <TableHead className="text-right">
      <Link href={href} scroll={false} className="inline-flex items-center gap-1 hover:underline" title="Ordenar por esta coluna">
        {children}
        <Arrow className={active ? "size-3.5" : "size-3.5 opacity-40"} />
      </Link>
    </TableHead>
  );
}

const GROUPING_LABELS: Record<Grouping, string> = { dia: "dia", semana: "semana", mes: "mês", ano: "ano" };

// More than MAX_CHART_COLUMNS columns: say why, and offer the groupings that fit.
function TooManyColumns({
  chart,
  grouping,
  href,
}: {
  chart: ChartRange;
  grouping: Grouping;
  href: (g: Grouping) => string;
}) {
  return (
    <div className="rounded-lg border border-signal bg-signal-soft px-4 py-6 text-sm text-signal-foreground shadow-[inset_4px_0_0_var(--signal)]">
      <p className="font-semibold">Demasiadas colunas para mostrar no gráfico.</p>
      <p className="mt-1">
        Agrupado por {GROUPING_LABELS[grouping]}, o período de {formatDate(chart.from)} a {formatDate(chart.to)} dá{" "}
        {chart.columns} colunas (o máximo é {MAX_CHART_COLUMNS}).
      </p>
      {chart.alternatives.length > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-2">
          Escolha um período mais curto ou agrupe por:
          {chart.alternatives.map((g) => (
            <Button key={g} variant="outline" size="sm" asChild>
              <Link href={href(g)} scroll={false}>
                {GROUPING_LABELS[g]}
              </Link>
            </Button>
          ))}
        </p>
      ) : (
        <p className="mt-3">Mesmo agrupado por ano não cabe. Escolha um período mais curto.</p>
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Sem dados neste período.</p>;
}
