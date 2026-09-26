"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

// Shown inside the app (header included) when a page fails to load on the server,
// most often because the database can't be reached.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <PageHeader title="Não foi possível carregar esta página" />
      <div className="max-w-prose space-y-4 rounded-lg border bg-card p-6 text-sm">
        <p>
          Houve um problema ao ler os dados. Normalmente é temporário: a base de dados pode estar a
          arrancar ou sem ligação.
        </p>
        <p className="text-muted-foreground">
          Tente novamente dentro de momentos. Se continuar, confirme que a aplicação está a correr
          (<code>docker compose up</code>).
          {error.digest && <> Referência do erro: {error.digest}.</>}
        </p>
        <Button onClick={reset}>
          <RefreshCw />
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}
