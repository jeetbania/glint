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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <kbd className="rounded-md bg-foreground/8 px-2 py-1 text-xs text-muted-foreground">
        {keys}
      </kbd>
    </div>
  );
}

function ShortcutsSection() {
  return (
    <div>
      <SectionHeading>Keyboard shortcuts</SectionHeading>
      <div className="divide-y divide-border/60">
        <ShortcutRow keys="⌘K" label="Open command palette" />
        <ShortcutRow keys="⌘⇧N" label="New note" />
        <ShortcutRow keys="⌘⇧T" label="New task" />
        <ShortcutRow keys="↑ ↓" label="Navigate palette results" />
        <ShortcutRow keys="↵" label="Open selected result" />
        <ShortcutRow keys="Esc" label="Close dialog / palette" />
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
    </div>
  );
}
