"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/encomendas", label: "Encomendas" },
  { href: "/resumo", label: "Resumo" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground/75 transition-colors hover:bg-white/10 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-white",
              active && "bg-white/15 text-primary-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
