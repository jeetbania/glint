"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, PenTool, StickyNote, KanbanSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/library", label: "Library", icon: LayoutGrid },
  { href: "/boards", label: "Boards", icon: PenTool },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare },
];

/** Floating segmented pill nav — the primary destinations, centered at
 * the top of the app like a native macOS toolbar tab switcher. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-pill flex items-center gap-0.5 p-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
