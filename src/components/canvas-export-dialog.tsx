"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExportBackground = "transparent" | "solid";

export function CanvasExportDialog({
  open,
  onOpenChange,
  onExport,
  exporting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (background: ExportBackground) => void;
  exporting: boolean;
}) {
  const [background, setBackground] = useState<ExportBackground>("solid");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export canvas</DialogTitle>
          <DialogDescription>
            Downloads a PNG cropped to fit everything on the canvas, with a little padding
            around the edges — not the whole infinite space.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBackground("solid")}
            className={cn(
              "rounded-xl border p-3 text-left text-sm transition-colors",
              background === "solid"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-foreground/4",
            )}
          >
            <div className="mb-2 h-12 rounded-md border border-border/60 bg-background" />
            Canvas background
          </button>
          <button
            type="button"
            onClick={() => setBackground("transparent")}
            className={cn(
              "rounded-xl border p-3 text-left text-sm transition-colors",
              background === "transparent"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-foreground/4",
            )}
          >
            <div
              className="mb-2 h-12 rounded-md border border-border/60"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(rgba(0,0,0,0.12) 0% 25%, transparent 0% 50%)",
                backgroundSize: "10px 10px",
              }}
            />
            Transparent
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={exporting} onClick={() => onExport(background)}>
            {exporting ? "Exporting…" : "Download PNG"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
