import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <PageHeader title="Página não encontrada" description="O endereço não existe ou foi alterado." />
      <Button asChild>
        <Link href="/encomendas">Ir para as encomendas</Link>
      </Button>
    </main>
  );
}
