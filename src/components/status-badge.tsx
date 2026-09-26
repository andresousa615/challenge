import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/format";
import type { OrderStatus } from "@/lib/filters";

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pendente: "bg-status-pendente text-status-pendente-foreground",
  em_preparacao: "bg-status-em-preparacao text-status-em-preparacao-foreground",
  enviada: "bg-status-enviada text-status-enviada-foreground",
  entregue: "bg-status-entregue text-status-entregue-foreground",
  cancelada: "bg-status-cancelada text-status-cancelada-foreground",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>;
}
