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
    <aside className="glass-panel my-3 ml-3 flex h-[calc(100vh-1.5rem)] w-56 shrink-0 flex-col rounded-2xl px-3 py-4">
      <div className="px-2 pb-4">
        <span className="font-heading text-lg font-semibold tracking-heading">
          Glint
        </span>
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
                "flex items-center gap-2.5 rounded-full px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
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
