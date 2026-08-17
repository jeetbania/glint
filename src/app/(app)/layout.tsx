import { Sidebar } from "@/components/sidebar";
import { PasteCaptureProvider } from "@/components/paste-capture-provider";
import { SwrProvider } from "@/components/swr-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SwrProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-panel mx-3 mt-3 flex h-12 shrink-0 items-center justify-end gap-1 rounded-full px-2">
            <ThemeToggle />
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <LogOut className="size-4" />
                Log out
              </Button>
            </form>
          </header>
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <PasteCaptureProvider />
    </SwrProvider>
  );
}
