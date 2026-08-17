"use client";

import { Search } from "lucide-react";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/command-palette";
import { Kbd } from "@/components/ui/kbd";

/** Header pill that opens the Cmd/Ctrl+K command palette — matches the
 * reference app's "Search ⌘K" trigger. */
export function SearchTriggerButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
      className="glass-pill flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground transition-all hover:brightness-105"
    >
      <Search className="size-3.5" />
      Search
      <Kbd>⌘K</Kbd>
    </button>
  );
}
