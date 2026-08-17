import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ComingSoon({
  icon: Icon,
  title,
  description,
  gradient = "gradient-lavender",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: "gradient-lavender" | "gradient-mint" | "gradient-peach" | "gradient-sage";
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full shadow-sm",
          gradient,
        )}
      >
        <Icon className="size-6 text-white drop-shadow-sm" />
      </div>
      <h2 className="font-heading text-lg font-semibold tracking-heading">
        {title}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
