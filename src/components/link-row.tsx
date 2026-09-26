"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// attention: a safety-yellow edge on the left, for rows that need someone to check them.
export function LinkRow({
  href,
  attention = false,
  children,
}: {
  href: string;
  attention?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        attention && "[&>td:first-child]:shadow-[inset_4px_0_0_var(--signal)]",
      )}
      onClick={(e) => {
        // Real links inside the row (the company name) navigate on their own.
        if ((e.target as HTMLElement).closest("a")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
