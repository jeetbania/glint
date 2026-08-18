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
  Square,
  Circle,
  Triangle,
  Slash,
  ArrowUpRight,
  CornerDownRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CanvasShapeVariant } from "@/types/canvas-object";

const SHAPE_OPTIONS: {
  variant: CanvasShapeVariant;
  label: string;
  icon: typeof Square;
  shortcut: string;
}[] = [
  { variant: "rectangle", label: "Rectangle", icon: Square, shortcut: "R" },
  { variant: "ellipse", label: "Ellipse", icon: Circle, shortcut: "E" },
  { variant: "triangle", label: "Triangle", icon: Triangle, shortcut: "Y" },
];
const LINE_OPTIONS: {
  variant: CanvasShapeVariant;
  label: string;
  icon: typeof Slash;
  shortcut: string;
}[] = [
  { variant: "line", label: "Line", icon: Slash, shortcut: "L" },
  { variant: "arrow", label: "Arrow", icon: ArrowUpRight, shortcut: "A" },
  { variant: "elbow-arrow", label: "Elbow arrow", icon: CornerDownRight, shortcut: "B" },
];

/** The FigJam-style left tool dock. Every "add" button is a one-shot
 * action — it drops the new thing centered in the current view
 * immediately (matching how "add image" already had to work, since a
 * file picker has no "click the canvas" step) rather than arming a mode
 * that then waits for a follow-up click. "Select" doesn't toggle a mode
 * either; it's just a clear-selection shortcut, kept visually "active"
 * to match the reference's always-on cursor tool. */
export function CanvasToolbar({
  onSelectTool,
  onAddImage,
  onAddSticky,
  onAddText,
  onAddShape,
  onAddFrame,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
}: {
  onSelectTool: () => void;
  onAddImage: () => void;
  onAddSticky: () => void;
  onAddText: () => void;
  onAddShape: (variant: CanvasShapeVariant) => void;
  onAddFrame: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
}) {
  return (
    <div className="glass-pill pointer-events-auto flex flex-col items-center gap-1 p-1.5">
      <ToolButton label="Select (clear selection)" active onClick={onSelectTool}>
        <MousePointer2 className="size-4" />
      </ToolButton>

      <ToolButton label="Add image" onClick={onAddImage}>
        <ImagePlus className="size-4" />
      </ToolButton>

      <ToolButton label="Add sticky note" onClick={onAddSticky}>
        <StickyNote className="size-4" />
      </ToolButton>

      <ToolButton label="Add text" onClick={onAddText}>
        <Type className="size-4" />
      </ToolButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Add shape"
          title="Add shape"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground data-popup-open:bg-foreground/6 data-popup-open:text-foreground"
        >
          <Shapes className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-44">
          {SHAPE_OPTIONS.map(({ variant, label, icon: Icon, shortcut }) => (
            <DropdownMenuItem key={variant} onClick={() => onAddShape(variant)}>
              <Icon className="size-4" />
              {label}
              <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {LINE_OPTIONS.map(({ variant, label, icon: Icon, shortcut }) => (
            <DropdownMenuItem key={variant} onClick={() => onAddShape(variant)}>
              <Icon className="size-4" />
              {label}
              <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolButton label="Add frame" onClick={onAddFrame}>
        <FrameIcon className="size-4" />
      </ToolButton>

      <span className="my-0.5 h-px w-6 bg-border" />

      <ToolButton label="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" />
      </ToolButton>

      <span className="my-0.5 h-px w-6 bg-border" />

      <ToolButton label="Export" onClick={onExport}>
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
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
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
