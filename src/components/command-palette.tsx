"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion, LayoutGroup } from "motion/react";
import useSWR, { useSWRConfig } from "swr";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Search,
  LayoutGrid,
  StickyNote,
  KanbanSquare,
  Tag,
  FilePlus,
  CheckSquare,
  FolderPlus,
  Sun,
  Moon,
  LogOut,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";

type Command = {
  id: string;
  label: string;
  icon: typeof Search;
  shortcut?: string;
  run: () => void | Promise<void>;
};

export const OPEN_COMMAND_PALETTE_EVENT = "glint:open-command-palette";

/** Global Cmd/Ctrl+K palette: fuzzy-filtered commands (navigation, quick
 * create, theme) plus a row of recently-saved items for a quick jump back
 * to the Library. Styled as an always-dark, vivid spotlight-style sheet
 * of glass — deliberately independent of the app's light/dark theme,
 * matching a native macOS Spotlight, per the reference project. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { mutate: globalMutate } = useSWRConfig();

  // Visuals only (images/links, same default as the Library grid) — a
  // plain unfiltered "recent" pull was dominated by bare tasks/notes,
  // which have no thumbnail and rendered as a row of generic "TASK"
  // placeholder boxes instead of anything worth glancing at.
  const { data } = useSWR<{ items: ApiItem[] }>(
    open ? "/api/items?type=image,link&limit=6" : null,
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

  const createAndGo = useCallback(
    async (kind: "note" | "task") => {
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
    },
    [globalMutate, router],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) {
          setOpen(false);
        } else {
          openPalette();
        }
        return;
      }
      // Global quick-create shortcuts — work from anywhere in the app,
      // matching the kbd hints shown next to the "New" buttons and in
      // this palette's own command list.
      if (mod && e.shiftKey && !openRef.current) {
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          void createAndGo("note");
        } else if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          void createAndGo("task");
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
  }, [createAndGo]);

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
    { id: "new-note", label: "New note", icon: FilePlus, shortcut: "⌘⇧N", run: () => createAndGo("note") },
    { id: "new-task", label: "New task", icon: CheckSquare, shortcut: "⌘⇧T", run: () => createAndGo("task") },
    {
      id: "new-collection",
      label: "New collection",
      icon: FolderPlus,
      run: createCollection,
    },
    { id: "go-library", label: "Go to Library", icon: LayoutGrid, run: () => router.push("/library") },
    { id: "go-notes", label: "Go to Notes", icon: StickyNote, run: () => router.push("/notes") },
    { id: "go-tasks", label: "Go to Tasks", icon: KanbanSquare, run: () => router.push("/tasks") },
    { id: "go-tags", label: "Go to Tags", icon: Tag, run: () => router.push("/tags") },
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
          // Positioning lives on the Popup itself; the glass panel below
          // is a plain (unlayered) div, so there's no cascade-layers
          // conflict between its `position: relative` and this `fixed`.
          className="fixed left-1/2 top-28 z-[60] w-full max-w-xl -translate-x-1/2 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.75)] backdrop-blur-2xl backdrop-saturate-150">
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <Search className="size-4 shrink-0 text-white/50" />
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
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {recent.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Recent
                  </p>
                  <div className="flex gap-2 overflow-x-auto px-2 pb-1">
                    {recent.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          router.push(`/library?item=${r.id}`);
                        }}
                        className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-white/10"
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
                          <div className="flex h-full items-center justify-center bg-white/8 text-[9px] uppercase text-white/50">
                            {r.type}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
                Commands
              </p>
              <LayoutGroup id="command-palette-list">
                <div className="space-y-0.5">
                  {filteredCommands.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => void execute(c)}
                      className="relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/80"
                    >
                      {i === clampedIndex && (
                        <motion.div
                          layoutId="cmdk-highlight"
                          className="absolute inset-0 rounded-lg bg-white/10 ring-1 ring-white/10"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <span className="relative z-10 flex flex-1 items-center gap-2.5">
                        <c.icon className="size-4 text-white/50" />
                        {c.label}
                      </span>
                      {c.shortcut && (
                        <kbd className="relative z-10 text-[10px] text-white/35">
                          {c.shortcut}
                        </kbd>
                      )}
                    </button>
                  ))}
                  {filteredCommands.length === 0 && (
                    <p className="px-2.5 py-6 text-center text-sm text-white/40">
                      No results
                    </p>
                  )}
                </div>
              </LayoutGroup>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[11px] text-white/35">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className={cn(hintKeyClass)}>
                    <ArrowUp className="size-2.5" />
                  </kbd>
                  <kbd className={cn(hintKeyClass)}>
                    <ArrowDown className="size-2.5" />
                  </kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className={cn(hintKeyClass)}>
                    <CornerDownLeft className="size-2.5" />
                  </kbd>
                  Open
                </span>
              </div>
              <kbd className={cn(hintKeyClass, "px-1.5")}>esc</kbd>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const hintKeyClass =
  "flex size-4.5 items-center justify-center rounded bg-white/10 text-white/50";
