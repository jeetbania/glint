import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A visible "keycap" chip for keyboard shortcut hints — pulled out into
 * one shared component so every shortcut hint in the app (header, Notes,
 * the New dropdown, Settings) reads the same way instead of some being
 * bare, barely-visible gray text and others properly boxed. */
export function Kbd({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <kbd
      className={cn(
        "rounded-md border border-border/60 bg-foreground/8 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
