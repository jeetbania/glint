"use client";

import {
  MousePointer2,
  ImagePlus,
  StickyNote,
  Type,
  Shapes,
  Frame as FrameIcon,
  Undo2,
  Redo2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasTool = "select" | "sticky" | "text" | "shape" | "frame";

/** The FigJam-style left tool dock — mirrors the reference: a select tool,
 * four "place something new" tools, an undo/redo pair, and export, each
 * group separated by a hairline. Image is a one-shot action (opens a file
 * picker immediately) rather than a persistent tool, since there's no
 * further "draw" step once a file's picked. */
export function CanvasToolbar({
  tool,
  onToolChange,
  onAddImage,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  exporting,
}: {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onAddImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="glass-pill pointer-events-auto flex flex-col items-center gap-1 p-1.5">
      <ToolButton
        label="Select"
        active={tool === "select"}
        onClick={() => onToolChange("select")}
      >
        <MousePointer2 className="size-4" />
      </ToolButton>

      <ToolButton label="Add image" active={false} onClick={onAddImage}>
        <ImagePlus className="size-4" />
      </ToolButton>

      <ToolButton
        label="Add sticky note"
        active={tool === "sticky"}
        onClick={() => onToolChange("sticky")}
      >
        <StickyNote className="size-4" />
      </ToolButton>

      <ToolButton
        label="Add text"
        active={tool === "text"}
        onClick={() => onToolChange("text")}
      >
        <Type className="size-4" />
      </ToolButton>

      <ToolButton
        label="Add shape"
        active={tool === "shape"}
        onClick={() => onToolChange("shape")}
      >
        <Shapes className="size-4" />
      </ToolButton>

      <ToolButton
        label="Add frame"
        active={tool === "frame"}
        onClick={() => onToolChange("frame")}
      >
        <FrameIcon className="size-4" />
      </ToolButton>

      <span className="my-0.5 h-px w-6 bg-border" />

      <ToolButton label="Undo" active={false} disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="Redo" active={false} disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" />
      </ToolButton>

      <span className="my-0.5 h-px w-6 bg-border" />

      <ToolButton
        label="Export as PNG"
        active={false}
        disabled={exporting}
        onClick={onExport}
      >
        <Download className="size-4" />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}
