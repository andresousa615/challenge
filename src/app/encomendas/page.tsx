import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Download } from "lucide-react";
import { LinkRow } from "@/components/link-row";
import { OrderFilters } from "@/components/order-filters";
import { PageHeader } from "@/components/page-header";
import { ProductCode, ProductName } from "@/components/product-name";
import { SignalText } from "@/components/signal";
import { StatusSelect } from "@/components/status-select";
import { SyncBar } from "@/components/sync-bar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDay, formatEur, formatQuantity, formatTime } from "@/lib/format";
import {
  filtersToQuery,
  hasActiveFilters,
  parseOrderFilters,
  type ListFilters,
  type SortKey,
} from "@/lib/filters";
import { listCompanies, listOrders, type OrderLineSummary } from "@/lib/orders";
import { getSyncStatus } from "@/lib/sync";

export const dynamic = "force-dynamic";

export default async function EncomendasPage({ searchParams }: PageProps<"/encomendas">) {
  const filters = parseOrderFilters(await searchParams);
  const [orders, companies] = await Promise.all([listOrders(filters), listCompanies()]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <PageHeader
        title="Encomendas"
        description="Encomendas recebidas por email, lidas automaticamente. Clique numa encomenda para ver o email original e corrigir os produtos."
        actions={<SyncBar status={getSyncStatus()} />}
      />

      <section className="rounded-lg border bg-card p-4">
        {/* key: remount when the URL changes (e.g. a header click) so the controls match it */}
        <OrderFilters
          key={filtersToQuery(filters)}
          filters={filters}
          companies={companies}
          exportAction={
            <Button variant="outline" asChild>
              <a href={`/api/export?${filtersToQuery(filters)}`}>
                <Download />
                Exportar CSV
              </a>
            </Button>
          }
        />
      </section>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">
          {hasActiveFilters(filters)
            ? "Nenhuma encomenda corresponde a estes filtros."
            : "Ainda não há encomendas. Carregue em Sincronizar para ir buscar os emails."}
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead filters={filters} sort="recebida">Recebida</SortHead>
                <SortHead filters={filters} sort="empresa">Empresa</SortHead>
                <TableHead>Contacto</TableHead>
                <SortHead filters={filters} sort="pretendida">Data pretendida</SortHead>
                <TableHead>Produtos</TableHead>
                <SortHead filters={filters} sort="total" className="text-right">Total</SortHead>
                <SortHead filters={filters} sort="estado">Estado</SortHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <LinkRow key={o.id} href={`/encomendas/${o.id}`} attention={o.incomplete}>
                  <TableCell>
                    <div>{formatDay(o.receivedAt)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(o.receivedAt)}</div>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/encomendas/${o.id}`}
                          className="line-clamp-2 max-w-44 rounded-sm font-semibold whitespace-normal hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {o.companyName ?? o.customerEmail}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{o.companyName ?? o.customerEmail}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.contact}</TableCell>
                  <TableCell>{formatDate(o.requestedDate)}</TableCell>
                  <TableCell>
                    <ProductList lines={o.lines} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-semibold">{formatEur(o.total)}</div>
                    {o.incomplete && <SignalText className="text-xs">incompleto</SignalText>}
                  </TableCell>
                  <TableCell>
                    <StatusSelect key={o.status} orderId={o.id} status={o.status} compact />
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" aria-label="Abrir encomenda" />
                  </TableCell>
                </LinkRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </main>
  );
}

const MAX_PRODUCTS_SHOWN = 3;

// What the client asked for, in the email's order; problems are highlighted.
function ProductList({ lines }: { lines: OrderLineSummary[] }) {
  if (lines.length === 0) return <SignalText>Sem produtos</SignalText>;
  const hidden = lines.length - MAX_PRODUCTS_SHOWN;

  return (
    <ul className="space-y-1 text-sm">
      {lines.slice(0, MAX_PRODUCTS_SHOWN).map((l, i) => (
        <li key={i}>
          <div className="flex items-baseline gap-1">
            {l.quantity === null ? (
              <SignalText className="shrink-0">Sem quantidade</SignalText>
            ) : (
              <span className="shrink-0 font-semibold">{formatQuantity(l.quantity, l.unit)}</span>
            )}
            <span className="text-muted-foreground">·</span>
            {l.description ? (
              <ProductName description={l.description} reference={l.reference} className="min-w-0 max-w-40" />
            ) : (
              <SignalText>Código desconhecido</SignalText>
            )}
          </div>
          <ProductCode reference={l.reference} className="block" />
        </li>
      ))}
      {hidden > 0 && (
        <li className="text-muted-foreground">
          + {hidden === 1 ? "1 produto" : `${hidden} produtos`}
        </li>
      )}
    </ul>
  );
}

// Text columns start ascending, dates and totals descending; clicking again flips.
function SortHead({
  filters,
  sort,
  className,
  children,
}: {
  filters: ListFilters;
  sort: SortKey;
  className?: string;
  children: React.ReactNode;
}) {
  const active = filters.sort === sort;
  const dir = active
    ? filters.dir === "asc" ? "desc" : "asc"
    : sort === "empresa" || sort === "estado" ? "asc" : "desc";
  const Arrow = !active ? ArrowUpDown : filters.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={className}>
      <Link
        href={`/encomendas?${filtersToQuery({ ...filters, sort, dir })}`}
        title="Ordenar por esta coluna"
        className="inline-flex items-center gap-1 hover:underline"
      >
        {children}
        <Arrow className={active ? "size-3.5" : "size-3.5 opacity-40"} />
      </Link>
    </TableHead>
  );
}
