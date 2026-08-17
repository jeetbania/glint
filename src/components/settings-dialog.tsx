"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useTheme } from "next-themes";
import useSWR from "swr";
import {
  Settings as SettingsIcon,
  X,
  Palette,
  Clipboard,
  Keyboard,
  Database,
  Info,
  Sun,
  Moon,
  Laptop,
  Download,
  Check,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useLocalStorage } from "@/lib/use-local-storage";
import { isTauri } from "@/lib/is-tauri";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "capture", label: "Capture", icon: Clipboard },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "data", label: "Data", icon: Database },
  { id: "about", label: "About", icon: Info },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsTriggerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Settings"
        onClick={() => setOpen(true)}
      >
        <SettingsIcon className="size-4" />
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<SectionId>("appearance");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[70] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
          <div className="glass-panel flex h-[28rem] overflow-hidden rounded-2xl">
            <aside className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border/60 p-3">
              <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
                Settings
              </p>
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                    section === s.id
                      ? "bg-foreground/8 font-medium"
                      : "text-muted-foreground hover:bg-foreground/4 hover:text-foreground",
                  )}
                >
                  <s.icon className="size-3.5 shrink-0" />
                  {s.label}
                </button>
              ))}
            </aside>

            <div className="relative min-w-0 flex-1 overflow-y-auto p-6">
              <DialogPrimitive.Close render={<Button variant="outline" size="icon-sm" className="absolute right-4 top-4" />}>
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>

              {section === "appearance" && <AppearanceSection />}
              {section === "capture" && <CaptureSection />}
              {section === "shortcuts" && <ShortcutsSection />}
              {section === "data" && <DataSection />}
              {section === "about" && <AboutSection />}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-heading text-lg font-semibold tracking-heading">
      {children}
    </h2>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const options = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Laptop },
  ] as const;

  return (
    <div>
      <SectionHeading>Appearance</SectionHeading>
      <p className="mb-3 text-xs font-medium text-muted-foreground">Theme</p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            className={cn(
              "glass-pill flex flex-1 flex-col items-center gap-1.5 px-4 py-3 text-xs transition-colors",
              theme === o.id ? "ring-2 ring-primary" : "hover:brightness-105",
            )}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CaptureSection() {
  const [clipboardWatch, setClipboardWatch] = useLocalStorage(
    "glint:settings:clipboard-watch",
    true,
  );
  const nativeAvailable = isTauri();

  return (
    <div>
      <SectionHeading>Capture</SectionHeading>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Paste anywhere</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cmd/Ctrl+V or drag-and-drop an image, link, or text anywhere in
            the app to save it. Always on — no editable field is ever
            hijacked.
          </p>
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Watch clipboard automatically</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {nativeAvailable
                ? "Copy a screenshot or link anywhere on your Mac and Glint will offer to save it, even when the app isn't focused."
                : "Desktop app only — available when running Glint as a native app, not in the browser."}
            </p>
          </div>
          <input
            type="checkbox"
            checked={clipboardWatch}
            disabled={!nativeAvailable}
            onChange={(e) => setClipboardWatch(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-primary disabled:opacity-40"
          />
        </label>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2.5 py-2.5 transition-colors hover:bg-foreground/4">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i} className="min-w-6 px-2 py-1 text-center text-xs">
            {k}
          </Kbd>
        ))}
      </div>
    </div>
  );
}

function ShortcutsSection() {
  return (
    <div>
      <SectionHeading>Keyboard shortcuts</SectionHeading>
      <div className="space-y-0.5">
        <ShortcutRow keys={["⌘", "K"]} label="Open command palette" />
        <ShortcutRow keys={["⌘", "⇧", "N"]} label="New note" />
        <ShortcutRow keys={["⌘", "⇧", "T"]} label="New task" />
        <ShortcutRow keys={["↑", "↓"]} label="Navigate palette results" />
        <ShortcutRow keys={["↵"]} label="Open selected result" />
        <ShortcutRow keys={["Esc"]} label="Close dialog / palette" />
      </div>
    </div>
  );
}

function DataSection() {
  const { data } = useSWR<{ items: ApiItem[] }>("/api/items?limit=500");
  const items = data?.items ?? [];
  const counts = {
    image: items.filter((i) => i.type === "image").length,
    link: items.filter((i) => i.type === "link").length,
    note: items.filter((i) => i.type === "note").length,
    task: items.filter((i) => i.type === "task").length,
  };

  function exportLibrary() {
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glint-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <SectionHeading>Data</SectionHeading>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["image", "link", "note", "task"] as const).map((type) => (
          <div key={type} className="glass-pill px-3 py-2 text-center">
            <p className="text-lg font-semibold tabular-nums">{counts[type]}</p>
            <p className="text-[11px] capitalize text-muted-foreground">
              {type}s
            </p>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={exportLibrary}>
        <Download className="size-3.5" />
        Export library as JSON
      </Button>
    </div>
  );
}

function AboutSection() {
  return (
    <div>
      <SectionHeading>About</SectionHeading>
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={48} height={48} className="size-12 rounded-xl" />
        <div>
          <p className="font-heading text-base font-semibold tracking-heading">
            Glint
          </p>
          <p className="text-xs text-muted-foreground">Version 0.1.0</p>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3.5" />A personal visual bookmarking app —
        paste anything, find it later.
      </p>
      {isTauri() && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <UpdateCheck />
        </div>
      )}
    </div>
  );
}

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; version: string }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

/** Only mounted inside the Tauri shell (see isTauri() gate above) — the
 * plugin packages this imports have no meaningful behavior in a browser
 * tab, so this whole component tree stays out of the web bundle's
 * critical path via the dynamic-ish gate at the call site. */
function UpdateCheck() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  async function handleCheck() {
    setState({ status: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setState({ status: "up-to-date" });
        return;
      }
      setState({ status: "available", version: update.version });

      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState({
            status: "downloading",
            progress: total > 0 ? downloaded / total : 0,
          });
        } else if (event.event === "Finished") {
          setState({ status: "ready" });
        }
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Update check failed",
      });
    }
  }

  async function handleRelaunch() {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Desktop app updates
      </p>
      {(state.status === "idle" || state.status === "up-to-date" || state.status === "error") && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCheck}>
            <RefreshCw className="size-3.5" />
            Check for updates
          </Button>
          {state.status === "up-to-date" && (
            <span className="text-xs text-muted-foreground">You&rsquo;re up to date.</span>
          )}
          {state.status === "error" && (
            <span className="text-xs text-destructive">{state.message}</span>
          )}
        </div>
      )}
      {state.status === "checking" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Checking for updates…
        </p>
      )}
      {state.status === "available" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Downloading version {state.version}…
        </p>
      )}
      {state.status === "downloading" && (
        <div>
          <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/8">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Downloading… {Math.round(state.progress * 100)}%
          </p>
        </div>
      )}
      {state.status === "ready" && (
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={handleRelaunch}>
            Restart to update
          </Button>
          <span className="text-xs text-muted-foreground">Update downloaded.</span>
        </div>
      )}
    </div>
  );
}
