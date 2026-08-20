"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Tag,
  Settings,
  LogOut,
  LayoutGrid,
  StickyNote,
  KanbanSquare,
  SlidersHorizontal,
  ArrowUpDown,
  Grid2x2,
  Plus,
  CheckSquare,
  FileText,
  Sun,
  Moon,
} from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { GhostBar } from "@/components/ui/ghost-card";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "library", label: <><LayoutGrid className="size-3.5" />Library</> },
  { value: "notes", label: <><StickyNote className="size-3.5" />Notes</> },
  { value: "tasks", label: <><KanbanSquare className="size-3.5" />Tasks</> },
];

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "link", label: "Links" },
];

// The manila-folder-tab silhouette and its resting fan positions,
// copied verbatim from collections-row.tsx's own FOLDER_TAB_PATH/
// CARD_ASPECT/REST — the real folder shape and layout math, not a
// redrawn approximation. Kept as a local static copy rather than
// importing CollectionsRow itself: that component pulls its own data
// over SWR and ships hover-physics/menus/rename/color-picker
// interactivity this mockup doesn't need, and a marketing page
// shouldn't live-resync every time the real library's folders change.
const FOLDER_TAB_PATH =
  "M0.000 23.430C-0.000 17.216 2.468 11.256 6.862 6.862C11.256 2.468 17.216 0.000 23.430 0.000C23.430 0.000 165.072 0.000 165.072 0.000C171.286 0.000 177.246 2.468 181.639 6.862C186.033 11.256 188.502 17.216 188.502 23.430C188.502 32.468 192.092 41.136 198.484 47.527C204.875 53.919 213.543 57.509 222.581 57.509C222.581 57.509 398.303 57.509 398.303 57.509C405.647 57.509 412.690 60.426 417.883 65.619C423.076 70.812 425.993 77.855 425.993 85.199C425.993 85.199 425.993 334.404 425.993 334.404C425.993 341.748 423.076 348.791 417.883 353.984C412.690 359.177 405.647 362.094 398.303 362.094C398.303 362.094 27.690 362.094 27.690 362.094C20.346 362.094 13.303 359.177 8.110 353.984C2.917 348.791 0.000 341.748 0.000 334.404C0.000 334.404 0.000 23.430 0.000 23.430Z";
const CARD_ASPECT = 426 / 362.09;
const FOLDER_REST = [
  { x: -30, y: 4, rotate: -4 },
  { x: 0, y: -6, rotate: 0 },
  { x: 30, y: 4, rotate: 4 },
];
const FOLDER_Z = [1, 2, 1];

// Real saved items from the live app (fetched from the actual, public
// /api/collections and /api/items — the password gate is off, see
// proxy.ts), snapshotted here rather than fetched live so the landing
// page stays a static page and doesn't change out from under a visitor
// whenever the real library changes. Every image is one of the
// mockuuups.studio device-mockup stock photos used to test the app, not
// a personal photo.
const BRANDING_IMG =
  "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-iphone-mockup-held-by-womans-hand-in-the-lounge-u75LRMHe91Hg6SyCq28ph59cRRoX4y.webp";
const WEBSITE_IMGS = [
  "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-ipad-pro-mockup-on-a-wooden-surface-with-shadows-5DjF9wxH5ggi7KZ1MeXgNaPhfVueH4.webp",
  "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-macbook-pro-mockup-with-a-man-in-a-casual-workspace-QMFoW6CU9CeVVXeKqwmFa9YCHyRmsi.webp",
  "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-tablet-mockup-on-a-table-t9H9Ch2VsnfrqTImUxvh2xMrEikDt5.webp",
];

const COLLECTIONS = [
  {
    name: "Branding",
    count: 2,
    hue: 176,
    slots: [{ kind: "note" as const }, { kind: "image" as const, src: BRANDING_IMG }],
  },
  {
    name: "Websites",
    count: 3,
    hue: 58,
    slots: WEBSITE_IMGS.map((src) => ({ kind: "image" as const, src })),
  },
];

const LIBRARY_IMAGES = [
  {
    src: "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-tablet-mockup-among-architects-tools-tuvw51pS3KkcWU2UBxl2pQaHJnFfYQ.webp",
    w: 3046,
    h: 2030,
    color: "#72d1c2",
  },
  {
    src: "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-macbook-pro-14-inch-mockup-with-female-hand-on-a-modern-desk-CD25MBRXvjkUnpdmg1vjowYNKjJBcE.webp",
    w: 3715,
    h: 2786,
    color: "#e2321c",
  },
  { src: WEBSITE_IMGS[2], w: 1670, h: 2506, color: "#2191f3" },
  { src: WEBSITE_IMGS[1], w: 3715, h: 2786, color: "#e23219" },
  { src: BRANDING_IMG, w: 3715, h: 2786, color: "#ca8334" },
  {
    src: "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-iphone-mockup-in-the-office-1-byT6CwF8PZCHmUGQYcGKhsjZuwVz83.webp",
    w: 3715,
    h: 2786,
    color: "#f6b251",
  },
  { src: WEBSITE_IMGS[0], w: 1800, h: 1350, color: "#0253e7" },
  {
    src: "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/mockuuups-imac-mockup-on-a-wooden-desk-in-sunlight-Dq5uVeUBZguNChssBTdaqj9Y4FTB5K.webp",
    w: 1800,
    h: 1350,
    color: "#16c0f7",
  },
];

const MOCK_NOTES = [
  { title: "List of references", lines: ["w-2/3"] },
  { title: "Onboarding copy edits", lines: ["w-3/4", "w-1/2"] },
  { title: "Gift ideas for Mom", lines: ["w-1/2"] },
];

const INITIAL_TASKS = [
  { id: 1, text: "Reply to design feedback thread", done: true },
  { id: 2, text: "Review onboarding flow", done: false },
  { id: 3, text: "Plan the Q3 launch", done: false },
];

function FolderTile({
  name,
  count,
  hue,
  slots,
}: {
  name: string;
  count: number;
  hue: number;
  slots: ({ kind: "note" } | { kind: "image"; src: string })[];
}) {
  return (
    <div
      style={{ "--folder-hue": hue, aspectRatio: CARD_ASPECT } as React.CSSProperties}
      className="group relative w-44 shrink-0 rounded-[18px] shadow-[0_10px_14px_-8px_rgba(0,0,0,0.18),0_3px_5px_-2px_rgba(0,0,0,0.1)] transition-transform duration-200 hover:scale-[1.02] sm:w-52"
    >
      <div className="absolute inset-0 overflow-hidden rounded-[18px]">
        <svg
          aria-hidden
          viewBox="0 0 426 362.09"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        >
          <path
            d={FOLDER_TAB_PATH}
            style={{
              fill: "color-mix(in oklch, oklch(var(--folder-l) var(--folder-c) var(--folder-hue)) calc(var(--folder-alpha) * 100%), transparent)",
            }}
          />
        </svg>

        <div className="folder-card-info pointer-events-none absolute inset-x-0 bottom-0 top-[32%] z-[2] flex flex-col justify-between rounded-[18px] p-3 sm:p-4">
          <p className="truncate font-heading text-base font-medium tracking-heading text-white sm:text-lg">
            {name}
          </p>
          <span className="text-xs tracking-heading text-white/70 sm:text-sm">
            {count} {count === 1 ? "save" : "saves"}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-[58%] items-end justify-center pb-2 transition-transform duration-300 group-hover:-translate-y-1">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={cn(
              "absolute h-20 w-16 rounded-[9px] shadow-[0_3px_5.5px_rgba(0,0,0,0.16),0_1px_2px_rgba(0,0,0,0.1)] transition-transform duration-300 sm:h-24 sm:w-20",
              slot.kind === "image"
                ? "overflow-hidden"
                : "flex flex-col gap-1 border border-border/60 bg-card p-1.5 sm:gap-1.5 sm:p-2",
            )}
            style={{
              zIndex: FOLDER_Z[i] ?? 1,
              transform: `translate(${FOLDER_REST[i]?.x ?? 0}px, ${FOLDER_REST[i]?.y ?? 0}px) rotate(${FOLDER_REST[i]?.rotate ?? 0}deg)`,
            }}
          >
            {slot.kind === "image" ? (
              <Image src={slot.src} alt="" fill className="object-cover" unoptimized />
            ) : (
              <>
                <div className="mb-0.5 h-1.5 w-3/4 rounded-full bg-foreground/20" />
                <GhostBar className="w-full" />
                <GhostBar className="w-2/3" />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A local, mockup-scoped dark/light toggle — deliberately not the real
 * ThemeToggle. The landing page itself is forced to light mode always
 * (see theme-provider.tsx), so a toggle that called the real
 * next-themes setTheme would visually do nothing here. This one just
 * flips a plain "dark" class on the mockup card's own wrapper instead;
 * Tailwind's dark: variant here is `:is(.dark *)` (globals.css), which
 * matches *any* .dark ancestor, not specifically <html> — so scoping it
 * to this one card and leaving the rest of the page alone works exactly
 * the same way the real ThemeToggle's html-level class does, just
 * contained to the demo instead of the whole page. */
function MockThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <Button type="button" variant="outline" size="icon-sm" aria-label="Toggle demo theme" onClick={onToggle}>
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </Button>
  );
}

/** The interactive centerpiece of the hero — a small, working replica of
 * the app's own shell (real Tabs, real Button/Input, the real
 * folder-tile shape and CSS recipe, and real saved images pulled from
 * the live app) rather than a screenshot or a hand-drawn mockup.
 * Library/Notes/Tasks tabs actually switch, the type-filter pill
 * actually slides, task checkboxes actually toggle, and the theme
 * toggle actually flips this card between light and dark; the toolbar
 * buttons (Filters, Sort, size, folder menus) look real but aren't
 * wired to anything, matching the shallow-on-purpose tradeoff that
 * keeps this page cheap to ship.
 *
 * Inert on phones (pointer-events-none below sm): a fiddly tap target
 * at that size does more harm than good. From sm up (tablet and wider)
 * it's fully interactive. */
export function AppMockup() {
  const [tab, setTab] = useState("library");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [dark, setDark] = useState(false);

  return (
    <div
      data-app-shell
      className={cn(
        "glass-panel pointer-events-none mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl select-none sm:pointer-events-auto sm:select-auto",
        dark && "dark",
      )}
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
          <MockThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
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
          <span className="glass-pill hidden items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground lg:flex">
            <Search className="size-3.5" />
            Search
            <Kbd>⌘K</Kbd>
          </span>
          <Button variant="outline" size="icon-sm" tabIndex={-1}>
            <Tag className="size-3.5" />
          </Button>
          <MockThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
          <Button variant="outline" size="icon-sm" tabIndex={-1}>
            <Settings className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" tabIndex={-1}>
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </header>

      <div className="min-h-[420px] overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-end gap-3 overflow-x-auto px-4 pb-1 pt-5 sm:gap-4 sm:px-5 sm:pt-6">
                {COLLECTIONS.map((c) => (
                  <FolderTile key={c.name} {...c} />
                ))}
                <button
                  type="button"
                  tabIndex={-1}
                  style={{ aspectRatio: CARD_ASPECT }}
                  className="flex w-44 shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-border/60 text-xs text-muted-foreground sm:w-52 sm:text-sm"
                >
                  <Plus className="size-4 sm:size-5" />
                  New collection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4 sm:gap-3 sm:px-5">
                <div className="relative max-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    readOnly
                    tabIndex={-1}
                    value=""
                    placeholder="Search your library…"
                    className="pl-8 text-sm"
                  />
                </div>
                <div className="hidden md:block">
                  <Tabs items={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="hidden gap-1.5 lg:inline-flex" tabIndex={-1}>
                    <SlidersHorizontal className="size-3.5" />
                    Filters
                  </Button>
                  <Button size="sm" variant="outline" className="hidden gap-1.5 xl:inline-flex" tabIndex={-1}>
                    <ArrowUpDown className="size-3.5" />
                    Most recent
                  </Button>
                  <div className="glass-pill hidden items-center gap-2 px-3 py-1.5 xl:flex">
                    <LayoutGrid className="size-3.5 text-muted-foreground" />
                    <div className="h-1 w-14 rounded-full bg-foreground/15">
                      <div className="h-1 w-1/2 rounded-full bg-foreground/40" />
                    </div>
                    <Grid2x2 className="size-3.5 text-muted-foreground" />
                  </div>
                  <Button size="sm" className="gap-1.5" tabIndex={-1}>
                    <Plus className="size-3.5" />
                    New
                  </Button>
                </div>
              </div>

              <div className="columns-2 gap-3 px-4 pb-5 sm:columns-3 sm:gap-3 sm:px-5">
                {LIBRARY_IMAGES.map((img, i) => (
                  <div
                    key={i}
                    className="relative mb-3 break-inside-avoid overflow-hidden rounded-xl shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)]"
                    style={{ aspectRatio: img.w / img.h }}
                  >
                    <Image src={img.src} alt="" fill className="object-cover" unoptimized sizes="200px" />
                    <span
                      className="absolute left-2 top-2 size-3 rounded-full border-2 border-white/80 shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
                      style={{ backgroundColor: img.color }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "notes" && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3"
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
              className="space-y-2 p-4 sm:p-5"
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
                      task.done ? "gradient-sage border-transparent" : "border-border",
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
