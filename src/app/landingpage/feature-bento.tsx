"use client";

import { motion } from "motion/react";
import { Search, Command, Lock, CheckSquare } from "lucide-react";
import { GhostBar } from "@/components/ui/ghost-card";
import { cn } from "@/lib/utils";

const COLOR_DOTS = [
  "#3b5bdb",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#4ade80",
  "#7dd3fc",
];

function BentoCard({
  className,
  eyebrow,
  title,
  body,
  children,
}: {
  className?: string;
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      whileHover={{ y: -4 }}
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass-panel flex flex-col justify-between gap-6 rounded-2xl p-6 sm:p-7",
        className,
      )}
    >
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </span>
        <h3 className="font-heading text-xl font-semibold tracking-heading">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {children}
    </motion.div>
  );
}

/** The mid-page bento grid — each cell explains one real feature using a
 * small, animated replica of that feature's own UI (the cancelable-upload
 * toast, the color dots, the folder fan, the note ghost card, ...)
 * instead of a screenshot or an illustration. Each visual carries one
 * small loop or scroll-triggered move of its own, on top of the shared
 * card lift/fade-in, so the grid reads as alive rather than a static
 * poster. */
export function FeatureBento() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BentoCard
          className="lg:col-span-2"
          eyebrow="Capture"
          title="Drop anything in"
          body="Paste an image, drop in a link, or jot a quick note. Glint saves it right away and figures out where it belongs, so nothing sits in a downloads folder."
        >
          <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card/80 p-3 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.3)]">
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
          </div>
        </BentoCard>

        <BentoCard
          eyebrow="Color"
          title="Every color, remembered"
          body="Glint reads the colors out of every image you save, so the one moody blue shot is a click away whenever it's the mood you're after."
        >
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="flex items-center gap-2"
          >
            {COLOR_DOTS.map((hex, i) => (
              <motion.span
                key={hex}
                variants={{
                  hidden: { opacity: 0, scale: 0.4 },
                  visible: { opacity: 1, scale: 1 },
                }}
                animate={
                  i === 2
                    ? { y: [0, -5, 0] }
                    : undefined
                }
                transition={
                  i === 2
                    ? { y: { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 } }
                    : { type: "spring", stiffness: 300, damping: 18 }
                }
                className="size-6 shrink-0 rounded-full border-2 border-white/80 shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
                style={{ backgroundColor: hex }}
              />
            ))}
          </motion.div>
        </BentoCard>

        <BentoCard
          eyebrow="Folders"
          title="Folders with their own color"
          body="Group things into a folder, give it a color, and see what's inside it before you even open it up."
        >
          <motion.div
            initial="stacked"
            whileInView="fanned"
            viewport={{ once: true, margin: "-80px" }}
            className="relative h-24 w-full"
          >
            <motion.div
              variants={{
                stacked: { x: 24, y: 12, rotate: 0 },
                fanned: { x: 6, y: 8, rotate: -6 },
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="absolute left-0 top-0 h-16 w-14 rounded-[10px] shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
              style={{ background: "oklch(85% 0.095 15deg / 0.6)" }}
            />
            <motion.div
              variants={{
                stacked: { x: 24, y: 12, rotate: 0 },
                fanned: { x: 14, y: 0, rotate: 3 },
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
              className="absolute left-0 top-0 h-16 w-14 rounded-[10px] shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
              style={{ background: "oklch(85% 0.095 220deg / 0.6)" }}
            />
            <motion.div
              variants={{
                stacked: { x: 24, y: 12, rotate: 0 },
                fanned: { x: 24, y: 3, rotate: 12 },
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="absolute left-0 top-0 flex h-16 w-14 flex-col gap-1 rounded-[10px] border border-border/60 bg-card p-2 shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
            >
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/20" />
              <GhostBar className="w-full" />
            </motion.div>
          </motion.div>
        </BentoCard>

        <BentoCard
          eyebrow="Notes & tasks"
          title="Not everything is a picture"
          body="Write a note, make a checklist, and it lives right alongside everything else you've saved, in the same folders and the same search."
        >
          <div className="w-full max-w-[220px] space-y-1.5 rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <motion.span
                variants={{
                  hidden: { scale: 0, rotate: -20 },
                  visible: { scale: 1, rotate: 0 },
                }}
                transition={{ type: "spring", stiffness: 350, damping: 14, delay: 0.15 }}
                className="gradient-sage flex size-4.5 items-center justify-center rounded-full"
              >
                <CheckSquare className="size-2.5 text-white" />
              </motion.span>
              Task
            </div>
            <p className="text-sm font-medium">Pack for the trip</p>
            <GhostBar className="w-3/4" />
            <GhostBar className="w-1/2" />
          </div>
        </BentoCard>

        <BentoCard
          eyebrow="Search"
          title="Everything, one search away"
          body="Hit Cmd+K from anywhere in Glint to jump straight to any item, folder, or note, no mouse required."
        >
          <div className="flex w-full items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex flex-1 items-center text-sm text-muted-foreground">
              Search Glint
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="ml-0.5 h-3.5 w-px bg-muted-foreground/70"
              />
            </span>
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              <Command className="size-2.5" />K
            </motion.span>
          </div>
        </BentoCard>

        <BentoCard
          className="lg:col-span-3"
          eyebrow="Privacy"
          title="Private by default"
          body="Glint is yours. No feed, no algorithm, no one else looking over your shoulder, just a quiet place to keep what matters to you."
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Lock className="size-4 shrink-0" />
            </motion.span>
            Only you can see what you save here.
          </div>
        </BentoCard>
      </div>
    </section>
  );
}
