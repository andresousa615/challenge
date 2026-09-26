import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// "Sinal" (safety yellow) means exactly one thing: this needs someone's attention.
// soft: something to check. strong: act now (e.g. a late delivery).
export function SignalBadge({
  children,
  strong = false,
  className,
}: {
  children: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        strong
          ? "bg-signal text-foreground"
          : "border-signal bg-signal-soft text-signal-foreground",
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export function SignalText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-medium text-signal-foreground", className)}>{children}</span>;
}
