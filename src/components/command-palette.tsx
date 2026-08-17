"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import useSWR, { useSWRConfig } from "swr";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Search,
  LayoutGrid,
  PenTool,
  StickyNote,
  KanbanSquare,
  Tag,
  Palette,
  FilePlus,
  CheckSquare,
  FolderPlus,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";

type Command = {
  id: string;
  label: string;
  icon: typeof Search;
  run: () => void | Promise<void>;
};

export const OPEN_COMMAND_PALETTE_EVENT = "glint:open-command-palette";

/** Global Cmd/Ctrl+K palette: fuzzy-filtered commands (navigation, quick
 * create, theme) plus a row of recently-saved items for a quick jump back
 * to the Library — mirrors the reference app's spotlight-style search. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { mutate: globalMutate } = useSWRConfig();

  const { data } = useSWR<{ items: ApiItem[] }>(
    open ? "/api/items?limit=6" : null,
  );
  const recent = data?.items ?? [];

  // Mirrored in a ref so the global keydown listener (registered once)
  // always sees the current open state without needing to re-subscribe.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Reset query/selection whenever the palette opens — done at the same
  // call site as setOpen(true) rather than in a follow-up effect, so
  // opening never triggers a second render pass.
  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) {
          setOpen(false);
        } else {
          openPalette();
        }
      }
    }
    function onOpenRequest() {
      openPalette();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  async function createAndGo(kind: "note" | "task") {
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "note"
          ? { type: "note", title: "Untitled note" }
          : { type: "task", title: "New task" },
      ),
    });
    void globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/items"),
    );
    toast.success(kind === "note" ? "Note created" : "Task created");
    router.push(kind === "note" ? "/notes" : "/tasks");
  }

  async function createCollection() {
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New collection" }),
    });
    void globalMutate("/api/collections");
    toast.success("Collection created");
    router.push("/library");
  }

  const commands: Command[] = [
    { id: "new-note", label: "New note", icon: FilePlus, run: () => createAndGo("note") },
    { id: "new-task", label: "New task", icon: CheckSquare, run: () => createAndGo("task") },
    {
      id: "new-collection",
      label: "New collection",
      icon: FolderPlus,
      run: createCollection,
    },
    { id: "go-library", label: "Go to Library", icon: LayoutGrid, run: () => router.push("/library") },
    { id: "go-boards", label: "Go to Boards", icon: PenTool, run: () => router.push("/boards") },
    { id: "go-notes", label: "Go to Notes", icon: StickyNote, run: () => router.push("/notes") },
    { id: "go-tasks", label: "Go to Tasks", icon: KanbanSquare, run: () => router.push("/tasks") },
    { id: "go-tags", label: "Go to Tags", icon: Tag, run: () => router.push("/tags") },
    { id: "go-colors", label: "Go to Colors", icon: Palette, run: () => router.push("/colors") },
    {
      id: "toggle-theme",
      label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: resolvedTheme === "dark" ? Sun : Moon,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    { id: "logout", label: "Log out", icon: LogOut, run: () => logout() },
  ];

  const filteredCommands = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
    : commands;
  const clampedIndex = Math.min(activeIndex, Math.max(filteredCommands.length - 1, 0));

  async function execute(command: Command) {
    setOpen(false);
    await command.run();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          // Positioning lives on the Popup itself; glass styling lives on
          // the child below. `.glass-panel` sets `position: relative`,
          // which — despite the `fixed` utility class also being present
          // here — would otherwise win the cascade (both land in the same
          // Tailwind layer, and this rule is declared later in the
          // stylesheet), pinning the palette to the top of the document
          // flow instead of the viewport.
          className="fixed left-1/2 top-28 z-[60] w-full max-w-xl -translate-x-1/2 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const command = filteredCommands[clampedIndex];
                  if (command) void execute(command);
                }
              }}
              placeholder="Search or run a command…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded-md bg-foreground/8 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              esc
            </kbd>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {recent.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recent
                </p>
                <div className="flex gap-2 overflow-x-auto px-2 pb-1">
                  {recent.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push("/library");
                      }}
                      className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border/60"
                    >
                      {r.blobUrl || r.previewImageUrl ? (
                        <Image
                          src={r.blobUrl ?? r.previewImageUrl!}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-foreground/6 text-[9px] uppercase text-muted-foreground">
                          {r.type}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Commands
            </p>
            <div className="space-y-0.5">
              {filteredCommands.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => void execute(c)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    i === clampedIndex
                      ? "bg-primary/15 text-foreground"
                      : "text-foreground/80 hover:bg-foreground/6",
                  )}
                >
                  <c.icon className="size-4 text-muted-foreground" />
                  {c.label}
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                  No results
                </p>
              )}
            </div>
          </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
