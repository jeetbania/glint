import Link from "next/link";
import { Tag, LogOut } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { PasteCaptureProvider } from "@/components/paste-capture-provider";
import { SwrProvider } from "@/components/swr-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { SearchTriggerButton } from "@/components/search-trigger-button";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SwrProvider>
      {/* This padding is the window-edge margin — in the desktop app it's
          where native vibrancy shows through (see globals.css's
          data-tauri-shell rules); in the browser it's invisible since it
          just matches the page background. The shell inside is a single
          grounded panel (not glass-everywhere) matching the "clean but
          usable" native reference. */}
      <div className="h-screen w-screen overflow-hidden p-2">
        <div
          data-app-shell
          className="glass-panel flex h-full w-full flex-col overflow-hidden rounded-2xl"
        >
          <header
            data-app-header
            data-tauri-drag-region
            className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 px-4 py-3"
          >
            <Link
              href="/library"
              className="flex items-center gap-1.5 font-heading text-sm font-semibold tracking-heading"
            >
              Glint
            </Link>

            <TopNav />

            <div className="flex items-center justify-end gap-1.5">
              <SearchTriggerButton />
              <Button variant="outline" size="icon-sm" render={<Link href="/tags" />}>
                <Tag className="size-4" />
              </Button>
              <ThemeToggle />
              <form action={logout}>
                <Button type="submit" variant="outline" size="icon-sm" aria-label="Log out">
                  <LogOut className="size-4" />
                </Button>
              </form>
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <PasteCaptureProvider />
      <CommandPalette />
    </SwrProvider>
  );
}
