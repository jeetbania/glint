import { cn } from "@/lib/utils";

/** One placeholder card in a fanned empty-state stack — plain neutral
 * chrome (border/shadow, no color), content supplied via children so
 * each view can mock up its own shape (an image block for the Library,
 * plain text lines for Notes, a checklist for Tasks) while sharing the
 * exact same card. Deliberately flat/monochrome — see the "no gradient
 * empty states" design note: a wall of identical cards reading as
 * "quiet scaffolding," not a colorful illustration competing with the
 * real (pastel/photo) cards it'll eventually be replaced by. */
export function GhostCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute rounded-xl border border-border/60 bg-card p-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A single skeleton text bar — the shared unit GhostCard content is
 * built from, so title-vs-body weight/width stays consistent across
 * every view's own mock instead of each one inventing its own bar
 * styling. */
export function GhostBar({ className }: { className?: string }) {
  return <div className={cn("h-2 rounded-full bg-foreground/8", className)} />;
}
