"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  PenTool,
  StickyNote,
  KanbanSquare,
  Tag,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/library", label: "Library", icon: LayoutGrid },
  { href: "/boards", label: "Boards", icon: PenTool },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/colors", label: "Colors", icon: Palette },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-muted/20 px-3 py-4">
      <div className="px-2 pb-4">
        <span className="text-lg font-semibold tracking-tight">mymind</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 pt-2 text-xs text-muted-foreground">
        Paste an image or link anywhere to save it.
      </div>
    </aside>
  );
}
