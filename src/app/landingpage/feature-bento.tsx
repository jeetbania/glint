"use client";

import { motion } from "motion/react";
import {
  Search,
  Command,
  ShieldCheck,
  CheckSquare,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { GhostBar } from "@/components/ui/ghost-card";
import { cn } from "@/lib/utils";

// A grayscale ramp plus one real blue accent — the only spot of color
// in the whole grid, standing in for "the color Glint remembers" while
// staying inside the no-gradient/mostly-monochrome brief. Uses the
// app's own --primary token (bg-primary) rather than a hardcoded hex,
// so it's the same blue as every button on the page and adapts with
// the theme.
const GRAY_SWATCHES = ["bg-foreground/15", "bg-foreground/30", "bg-foreground/50", "bg-foreground/70"];

/** A small nested "window" — a plain white/card-toned panel with a
 * hairline border, the recurring unit every scene is built from
 * (a save dialog, a folder, a note, a search result list). No rotation,
 * no color wash — depth comes from the panel sitting on the scene's
 * light gray backdrop, not from tilting or tinting it. */
function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

function BentoCard({
  className,
  title,
  body,
  sceneClassName,
  children,
}: {
  className?: string;
  title: string;
  body: string;
  sceneClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      whileHover={{ y: -3 }}
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
      }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass-panel flex flex-col gap-4 rounded-2xl p-3 sm:p-4",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-52 items-center justify-center overflow-hidden rounded-xl bg-muted/60 p-5 sm:h-60",
          sceneClassName,
        )}
      >
        {children}
      </div>
      <div className="space-y-1.5 px-2 pb-2">
        <h3 className="font-heading text-xl font-semibold tracking-heading">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </motion.div>
  );
}

/** The mid-page bento grid — each cell is a small wireframe-style
 * mockup of one real feature (the save dialog, the color swatches, a
 * folder, a note and a task, a search result list, the privacy note),
 * kept deliberately flat: no rotation, no colorful gradients, just
 * grayscale panels on a light gray backdrop with the app's own blue
 * (--primary) as the one accent, echoing a clean product-loading-state
 * illustration rather than a playful scattered collage. */
export function FeatureBento() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BentoCard
          className="lg:col-span-2"
          title="Drop anything in"
          body="Paste an image, drop in a link, or jot a quick note. Glint saves it right away and figures out where it belongs, so nothing sits in a downloads folder."
        >
          <Panel className="w-full max-w-sm p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <ImageIcon className="size-4 text-primary-foreground" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-sm font-medium">Saving moodboard.png…</p>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-foreground/8">
                  <motion.div
                    animate={{ x: ["-100%", "10%", "120%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-y-0 w-1/2 rounded-full bg-primary"
                  />
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Cancel
              </span>
            </div>
          </Panel>
        </BentoCard>

        <BentoCard
          title="Every color, remembered"
          body="Glint reads the colors out of every image you save, so the one moody blue shot is a click away."
        >
          <Panel className="w-full max-w-[220px] p-3.5">
            <span className="text-xs font-medium text-muted-foreground">Colors</span>
            <div className="mt-2.5 flex items-center gap-2.5">
              {GRAY_SWATCHES.map((tone) => (
                <span key={tone} className={cn("size-6 shrink-0 rounded-full", tone)} />
              ))}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-card ring-primary">
                <span className="size-full rounded-full bg-primary" />
              </span>
            </div>
            <p className="mt-2.5 text-xs font-medium text-muted-foreground">#3B5BDB</p>
          </Panel>
        </BentoCard>

        <BentoCard
          title="Folders with their own color"
          body="Group things into a folder, give it a color, and see what's inside before you even open it."
        >
          <div className="flex w-full max-w-[220px] items-stretch gap-2.5">
            <Panel className="flex-1 space-y-1.5 p-2.5">
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/25" />
              <GhostBar className="w-full" />
            </Panel>
            <Panel className="flex-1 space-y-1.5 border-primary/60 p-2.5">
              <div className="flex items-center justify-between">
                <div className="h-1.5 w-1/2 rounded-full bg-foreground/25" />
                <span className="size-2 shrink-0 rounded-full bg-primary" />
              </div>
              <GhostBar className="w-2/3" />
            </Panel>
          </div>
        </BentoCard>

        <BentoCard
          title="Not everything is a picture"
          body="Write a note, make a checklist, and it lives right alongside everything else you've saved."
        >
          <div className="flex w-full max-w-[240px] flex-col gap-2.5">
            <Panel className="space-y-1.5 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileText className="size-3 shrink-0" />
                Note
              </div>
              <p className="text-xs font-medium">Reading list</p>
              <GhostBar className="w-full" />
              <GhostBar className="w-2/3" />
            </Panel>
            <Panel className="flex items-center gap-2 p-2.5">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-primary">
                <CheckSquare className="size-2.5 text-primary-foreground" />
              </span>
              <p className="text-xs font-medium">Pack for the trip</p>
            </Panel>
          </div>
        </BentoCard>

        <BentoCard
          title="Everything, one search away"
          body="Hit Cmd+K from anywhere in Glint to jump straight to any item, folder, or note."
          sceneClassName="items-start pt-8"
        >
          <div className="w-full max-w-[220px] space-y-2">
            <Panel className="flex items-center gap-2 rounded-full px-3 py-2">
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
            </Panel>
            <Panel className="space-y-1 p-1.5">
              {[
                { label: "moodboard.png", type: "Image" },
                { label: "Moodboard notes", type: "Note" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                  <span className="size-5 shrink-0 rounded-md bg-foreground/10" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.label}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{row.type}</span>
                </div>
              ))}
            </Panel>
          </div>
        </BentoCard>

        <BentoCard
          className="lg:col-span-3"
          title="Private by default"
          body="Glint is yours. No feed, no algorithm, no one else looking over your shoulder, just a quiet place to keep what matters to you."
          sceneClassName="h-auto flex-col gap-4 py-6 sm:h-auto sm:flex-row sm:gap-6"
        >
          <div className="relative flex size-16 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-border/60" />
            <span className="absolute inset-2 rounded-full border border-border/50" />
            <span className="relative flex size-9 items-center justify-center rounded-full bg-primary">
              <ShieldCheck className="size-4 text-primary-foreground" />
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {["No feed", "No algorithm", "Just you"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </BentoCard>
      </div>
    </section>
  );
}
