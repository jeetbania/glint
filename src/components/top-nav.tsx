"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid, StickyNote, KanbanSquare } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";

// "Boards" was removed as a top-level destination — a Collection now
// opens its own infinite-canvas space directly (see
// /collections/[slug]), which is what Boards used to stand in for.
const navItems = [
  { value: "/library", label: <><LayoutGrid className="size-3.5" />Library</>, href: "/library" },
  { value: "/notes", label: <><StickyNote className="size-3.5" />Notes</>, href: "/notes" },
  { value: "/tasks", label: <><KanbanSquare className="size-3.5" />Tasks</>, href: "/tasks" },
];

/** Floating segmented pill nav — the primary destinations, centered at
 * the top of the app like a native macOS toolbar tab switcher. Shares
 * the same sliding-pill Tabs component (and motion) as every other
 * tab-like control in the app. */
export function TopNav() {
  const pathname = usePathname();
  const active = navItems.find((n) => pathname?.startsWith(n.value))?.value ?? navItems[0].value;

  return <Tabs items={navItems} value={active} />;
}
