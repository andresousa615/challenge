import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <PageHeader
        title="Encomenda não encontrada"
        description="Esta encomenda não existe. Pode ter sido apagada ou o endereço está errado."
      />
      <Button asChild>
        <Link href="/encomendas">Voltar às encomendas</Link>
      </Button>
    </main>
  );
}
