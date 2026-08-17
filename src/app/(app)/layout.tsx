import Link from "next/link";
import { Tag, Palette, LogOut } from "lucide-react";
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
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-3">
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
            <Button variant="outline" size="icon-sm" render={<Link href="/colors" />}>
              <Palette className="size-4" />
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
      <PasteCaptureProvider />
      <CommandPalette />
    </SwrProvider>
  );
}
