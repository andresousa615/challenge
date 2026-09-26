"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCode } from "@/components/product-name";
import { ScrollBox } from "@/components/scroll-box";
import { SignalBadge, SignalText } from "@/components/signal";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveOrderEdits, type EditInput } from "@/app/encomendas/actions";
import { MAX_QUANTITY } from "@/lib/extraction/types";
import { formatDate, formatEur, formatQuantity, formatUnitPrice } from "@/lib/format";
import type { OrderLineDetail } from "@/lib/orders";

type CatalogItem = { reference: string; description: string; unit: string; priceEur: number; active: boolean };

type Props = {
  orderId: number;
  contact: string | null;
  requestedDate: string | null;
  lines: OrderLineDetail[];
  total: number;
  incomplete: boolean;
  catalog: CatalogItem[];
};

function toInput(p: Props): EditInput {
  return {
    contact: p.contact ?? "",
    requestedDate: p.requestedDate ?? "",
    lines: p.lines.map((l) => ({ reference: l.reference, quantity: l.quantity?.toString() ?? "" })),
  };
}

export function OrderEditor(props: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditInput>(() => toInput(props));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byReference = new Map(props.catalog.map((c) => [c.reference, c]));
  // Products already on the order keep what they were saved with, even if discontinued since.
  const saved = new Map(props.lines.filter((l) => l.priceEur !== null).map((l) => [l.reference, l]));

  function startEditing() {
    setDraft(toInput(props));
    setError(null);
    setEditing(true);
  }
  function discard() {
    setConfirming(false);
    setEditing(false);
    setError(null);
  }
  function save() {
    setConfirming(false);
    startTransition(async () => {
      const message = await saveOrderEdits(props.orderId, draft);
      setError(message);
      if (!message) setEditing(false);
    });
  }
  const setLine = (i: number, patch: Partial<EditInput["lines"][number]>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Contacto</dt>
            <dd>{props.contact ?? "—"}</dd>
            <dt className="text-muted-foreground">Data pretendida</dt>
            <dd>{props.requestedDate ? formatDate(props.requestedDate) : "—"}</dd>
          </dl>
          <Button variant="outline" onClick={startEditing}>
            <Pencil />
            Editar
          </Button>
        </div>

        <ScrollBox className="max-h-[28rem] [&_[data-slot=table-container]]:max-h-[28rem]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referência</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Preço unitário</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-signal-foreground">
                  Nenhum produto identificado neste email. Use &quot;Editar&quot; para os adicionar.
                </TableCell>
              </TableRow>
            )}
            {props.lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  <ProductCode reference={l.reference} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  {l.description ?? <SignalBadge>Código desconhecido</SignalBadge>}
                </TableCell>
                <TableCell>{l.unit}</TableCell>
                <TableCell className="text-right">
                  {l.quantity === null ? (
                    <SignalBadge>Sem quantidade</SignalBadge>
                  ) : (
                    formatQuantity(l.quantity, null)
                  )}
                </TableCell>
                <TableCell className="text-right">{l.priceEur === null ? "" : formatUnitPrice(l.priceEur)}</TableCell>
                <TableCell className="text-right">{l.subtotal === null ? "" : formatEur(l.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right">Total</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-2">
                  {props.incomplete && <SignalBadge>incompleto</SignalBadge>}
                  {formatEur(props.total)}
                </span>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        </ScrollBox>
        {props.incomplete && props.lines.length > 0 && (
          <p className="text-sm text-muted-foreground">
            O total não inclui linhas com código desconhecido ou sem quantidade.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Contacto</span>
          <Input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Data pretendida</span>
          <Input
            type="date"
            value={draft.requestedDate}
            onChange={(e) => setDraft({ ...draft, requestedDate: e.target.value })}
          />
        </label>
      </div>

      <datalist id="catalog-references">
        {props.catalog
          .filter((c) => c.active)
          .map((c) => (
            <option key={c.reference} value={c.reference}>
              {c.description}
            </option>
          ))}
      </datalist>

      <ScrollBox className="max-h-[28rem] [&_[data-slot=table-container]]:max-h-[28rem]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referência</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="w-32">Quantidade</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {draft.lines.map((l, i) => {
            const ref = l.reference.trim().toUpperCase();
            const kept = saved.get(ref);
            const product = byReference.get(ref);
            return (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    list="catalog-references"
                    value={l.reference}
                    placeholder="ex.: PRF-AGL-40"
                    onChange={(e) => setLine(i, { reference: e.target.value })}
                  />
                </TableCell>
                <TableCell className="whitespace-normal text-sm">
                  {kept ? (
                    `${kept.description} (${kept.unit})`
                  ) : product?.active ? (
                    `${product.description} (${product.unit})`
                  ) : product ? (
                    <SignalText>Produto descontinuado: fica sem preço</SignalText>
                  ) : ref ? (
                    <SignalText>Código desconhecido</SignalText>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_QUANTITY}
                    step={1}
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover linha"
                    onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </ScrollBox>

      <Button
        variant="outline"
        onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, { reference: "", quantity: "" }] }))}
      >
        <Plus />
        Adicionar linha
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={() => setConfirming(true)} disabled={pending}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={discard} disabled={pending}>
          Cancelar
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Guardar alterações?</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza que quer guardar estas alterações?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={discard}>
              Descartar alterações
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Continuar a editar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
