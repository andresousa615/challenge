import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Long catalog names are cut with "…"; hovering shows the full name and the code.
export function ProductName({
  description,
  reference,
  className,
}: {
  description: string;
  reference: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("block max-w-56 truncate", className)}>{description}</span>
      </TooltipTrigger>
      <TooltipContent>
        {description} ({reference})
      </TooltipContent>
    </Tooltip>
  );
}

// A catalog reference as printed on a bin label: condensed, spaced, quiet.
export function ProductCode({ reference, className }: { reference: string; className?: string }) {
  return (
    <span className={cn("text-xs font-semibold tracking-wide text-muted-foreground [font-stretch:80%]", className)}>
      {reference}
    </span>
  );
}
