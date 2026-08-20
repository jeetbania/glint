"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  // The marketing page always opens in light mode, regardless of the
  // visitor's system preference or whatever theme they'd previously set
  // in the real app — a dark-mode flash on a first-impression page reads
  // worse than just picking one look for it. forcedTheme (not a
  // defaultTheme override) is what keeps this flash-free: next-themes'
  // blocking inline script applies it before first paint, the same way
  // it avoids a flash for the real app's own theme everywhere else. The
  // hero's own theme toggle demo still works — it flips a class scoped
  // to just the mockup card (see app-mockup.tsx), not this provider.
  const pathname = usePathname();
  const forcedTheme = pathname?.startsWith("/landingpage") ? "light" : undefined;

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  );
}
