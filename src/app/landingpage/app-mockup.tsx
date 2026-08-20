"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Search, Tag, FileText, CheckSquare } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { GhostBar } from "@/components/ui/ghost-card";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "library", label: "Library" },
  { value: "notes", label: "Notes" },
  { value: "tasks", label: "Tasks" },
];

// Stand-ins for real saved images — flat color blocks in the app's own
// functional gradient set (globals.css), not stock photos or fake
// screenshots. Heights vary to read as a loose masonry grid, same as
// the real Library.
const LIBRARY_TILES: { tint: string; className: string }[] = [
  { tint: "gradient-mint", className: "h-36" },
  { tint: "gradient-peach", className: "h-24" },
  { tint: "gradient-sky", className: "h-44" },
  { tint: "gradient-lavender", className: "h-28" },
  { tint: "gradient-rose", className: "h-32" },
  { tint: "gradient-sage", className: "h-40" },
];

const MOCK_NOTES = [
  { title: "Apartment ideas", lines: ["w-3/4", "w-1/2"] },
  { title: "Reading list", lines: ["w-2/3", "w-3/4", "w-2/5"] },
  { title: "Gift ideas for Mom", lines: ["w-1/2"] },
];

const INITIAL_TASKS = [
  { id: 1, text: "Book flights", done: true },
  { id: 2, text: "Send the deck to the team", done: false },
  { id: 3, text: "Renew domain", done: false },
];

/** The interactive centerpiece of the hero — a small, working replica of
 * the app's own shell (same glass panel, same sliding-pill Tabs, the
 * real ThemeToggle) rather than a screenshot or a hand-drawn mockup.
 * Deliberately shallow: switching tabs swaps a light static mock, not a
 * second copy of the real data-fetching views, so the landing page
 * stays cheap to ship.
 *
 * Inert on phones (pointer-events-none below sm): a fiddly tab/checkbox
 * target at that size does more harm than good, and a stray tap
 * flipping the whole site's theme is a bad first impression. From sm up
 * (tablet and wider, where targets are comfortably tappable/clickable)
 * it's fully interactive. */
export function AppMockup() {
  const [tab, setTab] = useState("library");
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  return (
    <div
      data-app-shell
      className="glass-panel pointer-events-none mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl select-none sm:pointer-events-auto sm:select-auto"
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-4 pt-3.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]/70" />
        <span className="size-2.5 rounded-full bg-[#febc2e]/70" />
        <span className="size-2.5 rounded-full bg-[#28c840]/70" />
      </div>
      {/* Below sm, the real three-column header (logo / tabs / icons)
          doesn't have room for all three at once — tabs either wrap
          under the fold or get clipped. Two short rows read cleanly at
          phone widths instead; sm and up go back to the single-row
          layout that mirrors the real app header. */}
      <header className="shrink-0 border-b border-border/60 sm:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-heading text-sm font-semibold tracking-heading">
            <Image src="/logo.png" alt="" width={22} height={22} className="rounded-[6px]" />
            Glint
          </span>
          <ThemeToggle />
        </div>
        <div className="flex justify-center pb-3">
          <Tabs items={TABS} value={tab} onChange={setTab} />
        </div>
      </header>

      <header className="hidden shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 px-4 py-3 sm:grid">
        <span className="flex items-center gap-2 font-heading text-sm font-semibold tracking-heading">
          <Image src="/logo.png" alt="" width={22} height={22} className="rounded-[6px]" />
          Glint
        </span>

        <Tabs items={TABS} value={tab} onChange={setTab} />

        <div className="flex items-center justify-end gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-full text-muted-foreground">
            <Search className="size-3.5" />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full text-muted-foreground">
            <Tag className="size-3.5" />
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="min-h-[320px] overflow-hidden p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {tab === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="columns-2 gap-3 sm:columns-3"
            >
              {LIBRARY_TILES.map((tile, i) => (
                <div
                  key={i}
                  className={cn(
                    "mb-3 break-inside-avoid rounded-xl shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)]",
                    tile.tint,
                    tile.className,
                  )}
                />
              ))}
              <MockNoteTile className="mb-3" />
              <MockTaskTile className="mb-3" done />
            </motion.div>
          )}

          {tab === "notes" && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {MOCK_NOTES.map((note) => (
                <div
                  key={note.title}
                  className="space-y-1.5 rounded-xl border border-border/60 bg-card p-3"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="gradient-peach flex size-4.5 items-center justify-center rounded-full">
                      <FileText className="size-2.5 text-white" />
                    </span>
                    Note
                  </div>
                  <p className="text-sm font-medium">{note.title}</p>
                  {note.lines.map((w, i) => (
                    <GhostBar key={i} className={w} />
                  ))}
                </div>
              ))}
            </motion.div>
          )}

          {tab === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() =>
                    setTasks((prev) =>
                      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
                    )
                  }
                  className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:bg-foreground/3"
                >
                  <span
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      task.done
                        ? "gradient-sage border-transparent"
                        : "border-border",
                    )}
                  >
                    {task.done && <CheckSquare className="size-3 text-white" />}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors",
                      task.done && "text-muted-foreground line-through",
                    )}
                  >
                    {task.text}
                  </span>
                </button>
              ))}
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Go ahead, check one off.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Small stand-ins for the note/task indicator that shows up inside a
// folder preview — same idea, shrunk to sit in the Library mock grid.
function MockNoteTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex break-inside-avoid flex-col gap-1.5 rounded-xl border border-border/60 bg-card p-2.5",
        className,
      )}
    >
      <div className="mb-0.5 h-2 w-3/4 rounded-full bg-foreground/20" />
      <GhostBar className="w-full" />
      <GhostBar className="w-2/3" />
    </div>
  );
}

function MockTaskTile({ className, done }: { className?: string; done?: boolean }) {
  return (
    <div
      className={cn(
        "flex break-inside-avoid items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[5px]",
          done ? "gradient-sage" : "border border-border",
        )}
      >
        {done && <CheckSquare className="size-2.5 text-white" />}
      </span>
      <GhostBar className="w-2/3" />
    </div>
  );
}
