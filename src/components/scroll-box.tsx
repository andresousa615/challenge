import { cn } from "@/lib/utils";

// Caps the height of a long table or list and scrolls inside it. For shadcn tables the
// inner table container does the scrolling, so the header (and a total row) can stay visible.
export function ScrollBox({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "max-h-80 overflow-y-auto",
        "[&_[data-slot=table-container]]:max-h-80 [&_[data-slot=table-container]]:overflow-y-auto",
        "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-muted",
        "[&_tfoot]:sticky [&_tfoot]:bottom-0 [&_tfoot]:z-10 [&_tfoot]:bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
