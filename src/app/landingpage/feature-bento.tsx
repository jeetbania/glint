"use client";

import { motion } from "motion/react";
import {
  Search,
  Command,
  ShieldCheck,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Folder as FolderIcon,
  StickyNote,
} from "lucide-react";
import { GhostBar } from "@/components/ui/ghost-card";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
  { hex: "#3b5bdb", y: 0 },
  { hex: "#14b8a6", y: 6 },
  { hex: "#f97316", y: -4 },
  { hex: "#a855f7", y: 3 },
  { hex: "#ec4899", y: -6 },
  { hex: "#4ade80", y: 5 },
  { hex: "#7dd3fc", y: -2 },
  { hex: "#fbbf24", y: 4 },
];
const PICKED_HEX = "#3b5bdb";

/** A small floating label card — the recurring motif across the whole
 * grid (a saved-type badge, a hex chip, "no feed" pills, ...), always
 * the same glass-pill treatment, hand-rotated a few degrees so it reads
 * as "placed" rather than grid-aligned.
 *
 * Rotation is a `rotate` prop, not a Tailwind `rotate-*` class in
 * `className` — this element also animates `scale`, and Framer writes
 * the *entire* `transform` as one inline style once it owns any
 * transform-related value, which silently discards a class-based
 * `transform` (rotate included) sitting underneath it. Confirmed via
 * computed style: the class version rendered `transform: none`. Fold
 * rotate into the same variants Framer already manages instead. */
function FloatingChip({
  icon: Icon,
  children,
  className,
  rotate = 0,
  delay = 0,
}: {
  icon?: typeof CheckSquare;
  children: React.ReactNode;
  className?: string;
  rotate?: number;
  delay?: number;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, scale: 0.7, rotate }, visible: { opacity: 1, scale: 1, rotate } }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay }}
      className={cn(
        "glass-pill absolute z-20 flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium text-foreground shadow-[0_8px_20px_-8px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      {Icon && <Icon className="size-3 shrink-0 text-muted-foreground" />}
      {children}
    </motion.div>
  );
}

function BentoCard({
  className,
  eyebrow,
  title,
  body,
  glow,
  sceneClassName,
  children,
}: {
  className?: string;
  eyebrow: string;
  title: string;
  body: string;
  /** A subtle color wash behind the illustration — the same kind of soft
   * radial glow as the hero's header highlight, just toned way down and
   * confined to one card instead of the whole page. */
  glow: string;
  sceneClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      whileHover={{ y: -4 }}
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
      }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass-panel relative flex flex-col gap-4 overflow-hidden rounded-2xl p-3 sm:p-4",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-30 blur-3xl dark:opacity-15"
        style={{ background: glow }}
      />
      <div
        className={cn(
          "relative flex h-52 items-center justify-center overflow-hidden rounded-xl bg-foreground/[0.025] sm:h-60",
          sceneClassName,
        )}
      >
        {children}
      </div>
      <div className="relative space-y-1.5 px-2 pb-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </span>
        <h3 className="font-heading text-xl font-semibold tracking-heading">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </motion.div>
  );
}

/** The mid-page bento grid — each cell is a small illustrated "scene"
 * built from the app's own real UI pieces (the cancelable-upload toast,
 * the color dots, the folder shape, the note/task ghost cards, the
 * search bar) rather than a stock screenshot, styled with the same
 * floating-chip/soft-glow language throughout so the grid reads as one
 * illustrated system instead of six unrelated widgets. */
export function FeatureBento() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BentoCard
          className="lg:col-span-2"
          eyebrow="Capture"
          title="Drop anything in"
          glow="radial-gradient(circle, #7dd3fc, transparent 70%)"
          body="Paste an image, drop in a link, or jot a quick note. Glint saves it right away and figures out where it belongs, so nothing sits in a downloads folder."
        >
          <div
            aria-hidden
            className="absolute inset-6 rounded-xl border-2 border-dashed border-border/40"
          />
          <FloatingChip icon={ImageIcon} className="left-[8%] top-[16%]" rotate={-6} delay={0.1}>
            Image saved
          </FloatingChip>
          <FloatingChip icon={LinkIcon} className="right-[10%] top-[12%]" rotate={4} delay={0.2}>
            Link saved
          </FloatingChip>
          <FloatingChip icon={StickyNote} className="bottom-[14%] right-[12%]" rotate={6} delay={0.3}>
            Note saved
          </FloatingChip>

          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.92, rotate: -2 },
              visible: { opacity: 1, scale: 1, rotate: -2 },
            }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="relative z-10 w-full max-w-xs rounded-xl border border-border/60 bg-card p-3 shadow-[0_16px_36px_-12px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center gap-3">
              <motion.span
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="size-8 shrink-0 rounded-lg gradient-sky"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-sm font-medium">Saving moodboard.png…</p>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-foreground/8">
                  <motion.div
                    animate={{ x: ["-100%", "10%", "120%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-y-0 w-1/2 rounded-full bg-foreground/30"
                  />
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Cancel
              </span>
            </div>
          </motion.div>
        </BentoCard>

        <BentoCard
          eyebrow="Color"
          title="Every color, remembered"
          glow="radial-gradient(circle, #f472b6, transparent 70%)"
          body="Glint reads the colors out of every image you save, so the one moody blue shot is a click away."
        >
          <FloatingChip icon={undefined} className="inset-x-0 top-[14%] mx-auto w-fit" delay={0.35}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: PICKED_HEX }} />
            {PICKED_HEX.toUpperCase()}
          </FloatingChip>
          <div className="grid grid-cols-4 gap-3">
            {COLOR_SWATCHES.map((swatch, i) => (
              <motion.span
                key={swatch.hex}
                variants={{
                  hidden: { opacity: 0, scale: 0.4 },
                  visible: { opacity: 1, scale: swatch.hex === PICKED_HEX ? 1.1 : 1 },
                }}
                transition={{ type: "spring", stiffness: 280, damping: 16, delay: i * 0.03 }}
                style={{ backgroundColor: swatch.hex, y: swatch.y }}
                className={cn(
                  "size-9 shrink-0 rounded-full border-2 border-white/80 shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:size-10",
                  swatch.hex === PICKED_HEX && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background",
                )}
              />
            ))}
          </div>
        </BentoCard>

        <BentoCard
          eyebrow="Folders"
          title="Folders with their own color"
          glow="radial-gradient(circle, #fbbf24, transparent 70%)"
          body="Group things into a folder, give it a color, and see what's inside before you even open it."
        >
          <FloatingChip icon={FolderIcon} className="right-[10%] top-[14%]" rotate={4} delay={0.3}>
            12 folders
          </FloatingChip>
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
            className="relative flex h-24 w-36 items-center justify-center"
          >
            {/* x is set via Framer's own transform (not a Tailwind
                translate-x-* class) — Framer writes the whole transform
                string for an animated element from x/y/rotate, silently
                overriding any CSS-class transform on the same node. */}
            <motion.div
              variants={{
                hidden: { opacity: 0, x: -34, y: 10, rotate: 0 },
                visible: { opacity: 1, x: -34, y: 0, rotate: -8 },
              }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="absolute flex h-20 w-24 flex-col justify-end rounded-xl p-2.5 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.3)]"
              style={{ background: "color-mix(in oklch, oklch(85% 0.11 15deg) 65%, transparent)" }}
            >
              <span className="text-[11px] font-medium text-white/90">Recipes</span>
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, x: 34, y: 10, rotate: 0 },
                visible: { opacity: 1, x: 34, y: 0, rotate: 8 },
              }}
              transition={{ type: "spring", stiffness: 240, damping: 20, delay: 0.05 }}
              className="absolute flex h-20 w-24 flex-col justify-end rounded-xl p-2.5 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.3)]"
              style={{ background: "color-mix(in oklch, oklch(85% 0.11 220deg) 65%, transparent)" }}
            >
              <span className="text-[11px] font-medium text-white/90">Branding</span>
            </motion.div>
          </motion.div>
        </BentoCard>

        <BentoCard
          eyebrow="Notes & tasks"
          title="Not everything is a picture"
          glow="radial-gradient(circle, #86efac, transparent 70%)"
          body="Write a note, make a checklist, and it lives right alongside everything else you've saved."
        >
          <FloatingChip icon={CheckSquare} className="right-[8%] top-[12%]" rotate={6} delay={0.3}>
            Synced everywhere
          </FloatingChip>
          <motion.div
            variants={{ hidden: { opacity: 0, x: -8, rotate: 0 }, visible: { opacity: 1, x: 0, rotate: -5 } }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="absolute left-[16%] top-[20%] w-36 space-y-1.5 rounded-xl border border-border/60 bg-card p-2.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="gradient-peach flex size-4 items-center justify-center rounded-full">
                <FileText className="size-2.5 text-white" />
              </span>
              Note
            </div>
            <p className="text-xs font-medium">Reading list</p>
            <GhostBar className="w-full" />
            <GhostBar className="w-2/3" />
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, x: 8, rotate: 0 }, visible: { opacity: 1, x: 0, rotate: 4 } }}
            transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.08 }}
            className="absolute bottom-[16%] right-[14%] w-36 space-y-1.5 rounded-xl border border-border/60 bg-card p-2.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="gradient-sage flex size-4 items-center justify-center rounded-full">
                <CheckSquare className="size-2.5 text-white" />
              </span>
              Task
            </div>
            <p className="text-xs font-medium">Pack for the trip</p>
            <GhostBar className="w-3/4" />
            <GhostBar className="w-1/2" />
          </motion.div>
        </BentoCard>

        <BentoCard
          eyebrow="Search"
          title="Everything, one search away"
          glow="radial-gradient(circle, #a78bfa, transparent 70%)"
          body="Hit Cmd+K from anywhere in Glint to jump straight to any item, folder, or note."
          sceneClassName="items-start justify-center pt-8"
        >
          <div className="w-full max-w-[220px] space-y-2">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)]">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex flex-1 items-center text-sm text-muted-foreground">
                moodboard
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  className="ml-0.5 h-3.5 w-px bg-muted-foreground/70"
                />
              </span>
              <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="size-2.5" />K
              </span>
            </div>
            <motion.div
              variants={{ hidden: { opacity: 0, y: -6 }, visible: { opacity: 1, y: 0 } }}
              transition={{ delay: 0.15 }}
              className="space-y-1 rounded-xl border border-border/60 bg-card p-1.5 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.3)]"
            >
              {[
                { label: "moodboard.png", type: "Image", tint: "gradient-sky" },
                { label: "Moodboard notes", type: "Note", tint: "gradient-peach" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                  <span className={cn("size-5 shrink-0 rounded-md", row.tint)} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.label}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{row.type}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </BentoCard>

        <BentoCard
          className="lg:col-span-3"
          eyebrow="Privacy"
          title="Private by default"
          glow="radial-gradient(circle, #94a3b8, transparent 70%)"
          body="Glint is yours. No feed, no algorithm, no one else looking over your shoulder, just a quiet place to keep what matters to you."
          sceneClassName="h-36 sm:h-40"
        >
          <div className="relative flex size-20 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-border/50" />
            <span className="absolute inset-2 rounded-full border border-border/40" />
            <motion.span
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex size-11 items-center justify-center rounded-full bg-card shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)]"
            >
              <ShieldCheck className="size-5 text-foreground" />
            </motion.span>
          </div>
          <FloatingChip className="left-[6%] top-[10%] sm:left-[22%]" rotate={-6} delay={0.15}>
            No feed
          </FloatingChip>
          <FloatingChip className="right-[8%] top-[14%] sm:right-[22%]" rotate={4} delay={0.25}>
            No algorithm
          </FloatingChip>
          <FloatingChip className="bottom-[12%] right-[16%] sm:right-[26%]" rotate={6} delay={0.35}>
            Just you
          </FloatingChip>
        </BentoCard>
      </div>
    </section>
  );
}
