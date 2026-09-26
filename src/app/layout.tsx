import type { Metadata } from "next";
import Link from "next/link";
import { Archivo } from "next/font/google";
import { MainNav } from "@/components/main-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// One family with a width axis: condensed for headings, normal for text (see brain/design-system.md).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Ferrapex — Encomendas",
  description: "Encomendas recebidas por email",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-8 px-6 py-3">
            <Link href="/encomendas" className="text-xl font-extrabold tracking-tight [font-stretch:125%]">
              Ferrapex
            </Link>
            <MainNav />
          </div>
        </header>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
