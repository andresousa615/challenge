import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderEditor } from "@/components/order-editor";
import { PageHeader } from "@/components/page-header";
import { StatusSelect } from "@/components/status-select";
import { StatusTimeline } from "@/components/status-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadCatalog } from "@/lib/catalog";
import { formatDay, formatTime, isoDay, todayIso } from "@/lib/format";
import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function EncomendaPage({ params }: PageProps<"/encomendas/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [order, catalog] = await Promise.all([getOrder(id), loadCatalog()]);
  if (!order) notFound();

  const unknown = order.lines.filter((l) => l.description === null).length;
  const missingQty = order.lines.filter((l) => l.quantity === null).length;
  const problems = [
    order.lines.length === 0 && "nenhum produto identificado",
    unknown > 0 && (unknown === 1 ? "1 código desconhecido" : `${unknown} códigos desconhecidos`),
    missingQty > 0 && (missingQty === 1 ? "1 linha sem quantidade" : `${missingQty} linhas sem quantidade`),
    !order.requestedDate && "sem data pretendida",
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <Link href="/encomendas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Todas as encomendas
      </Link>

      <PageHeader
        title={order.companyName ?? order.customerEmail}
        description={`Recebida a ${formatDay(order.receivedAt)} às ${formatTime(order.receivedAt)}, de ${order.customerEmail}`}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Estado</span>
            <StatusSelect key={order.status} orderId={order.id} status={order.status} />
          </label>
        }
      />

      {problems.length > 0 && (
        <div className="rounded-lg border border-signal bg-signal-soft px-4 py-3 text-sm text-signal-foreground shadow-[inset_4px_0_0_var(--signal)]">
          <span className="font-semibold">A rever:</span> {problems.join(", ")}. Compare com o email
          original e use &quot;Editar&quot; para corrigir.
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <section className="rounded-lg border bg-card p-4">
          <OrderEditor
            orderId={order.id}
            contact={order.contact}
            requestedDate={order.requestedDate}
            lines={order.lines}
            total={order.total}
            incomplete={order.incomplete}
            catalog={catalog.map((c) => ({
              reference: c.reference,
              description: c.description,
              unit: c.unit,
              priceEur: c.priceEur,
              active: c.active,
            }))}
          />
        </section>

        <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline
              key={JSON.stringify(order.timeline)}
              orderId={order.id}
              received={`${formatDay(order.receivedAt)} às ${formatTime(order.receivedAt)}`}
              receivedDay={isoDay(order.receivedAt)}
              today={todayIso()}
              dates={order.timeline}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email original</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{order.emailBody}</pre>
          </CardContent>
        </Card>
        </div>
      </div>
    </main>
  );
}
