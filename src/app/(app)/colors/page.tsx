import Link from "next/link";
import { Palette } from "lucide-react";
import { listColorFamilyCounts } from "@/lib/items";
import { swatchHex } from "@/lib/color";

// Color-family counts change on every paste — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function ColorsPage() {
  const colors = await listColorFamilyCounts();

  if (colors.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Palette className="size-6" />
        No colors extracted yet. Paste an image to see its palette here.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 font-heading text-lg font-semibold tracking-heading">
        Colors
      </h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {colors.map((c) => (
          <Link
            key={c.color}
            href={`/library?color=${c.color}`}
            className="glass-panel flex flex-col items-center gap-2 rounded-xl p-4 transition-all hover:brightness-105"
          >
            <span
              className="size-10 rounded-full border border-black/10 shadow-inner dark:border-white/10"
              style={{ backgroundColor: swatchHex(c.color) }}
            />
            <span className="text-sm font-medium capitalize">{c.color}</span>
            <span className="text-xs text-muted-foreground">{c.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
