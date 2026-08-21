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
  ArrowRight,
  ArrowLeftRight,
  CornerDownRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CanvasShapeVariant, ConnectorToolId } from "@/types/canvas-object";

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

// Connector tools — unlike SHAPE_OPTIONS above, picking one of these ARMS
// the tool (drag-to-draw on the canvas) instead of one-shot-placing
// something; see onArmConnectorTool/pendingConnectorTool. All four create
// the exact same underlying connector object, just with a different
// connectorType/startDecoration/endDecoration preset (CONNECTOR_PRESETS
// in collection-canvas.tsx) — every one of them freely editable
// afterward from the object toolbar, so this list is really just
// starting points, not fixed categories.
const CONNECTOR_OPTIONS: {
  id: ConnectorToolId;
  label: string;
  icon: typeof Slash;
  shortcut: string;
}[] = [
  { id: "line", label: "Line", icon: Slash, shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: ArrowRight, shortcut: "A" },
  { id: "two-way-arrow", label: "Two-way arrow", icon: ArrowLeftRight, shortcut: "W" },
  { id: "elbow", label: "Elbow connector", icon: CornerDownRight, shortcut: "B" },
];

/** The FigJam-style left tool dock. Every "add" button except the
 * connector tools is a one-shot action — it drops the new thing centered
 * in the current view immediately (matching how "add image" already had
 * to work, since a file picker has no "click the canvas" step) rather
 * than arming a mode that then waits for a follow-up click. The
 * connector tools are the one deliberate exception: a connector's whole
 * shape comes from where you drag, so picking one arms it (crosshair
 * cursor, stays active until you draw one or hit Select/Escape) instead.
 * "Select" doesn't toggle a mode either; it's a clear-selection/disarm
 * shortcut, kept visually "active" to match the reference's always-on
 * cursor tool. */
export function CanvasToolbar({
  onSelectTool,
  onAddImage,
  onAddSticky,
  onAddText,
  onAddShape,
  onArmFrameTool,
  pendingFrameTool,
  pendingConnectorTool,
  onArmConnectorTool,
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
  onArmFrameTool: () => void;
  pendingFrameTool: boolean;
  pendingConnectorTool: ConnectorToolId | null;
  onArmConnectorTool: (id: ConnectorToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
}) {
  return (
    <div className="glass-pill pointer-events-auto flex flex-col items-center gap-1 p-1.5">
      <ToolButton
        label="Select (clear selection)"
        active={!pendingConnectorTool && !pendingFrameTool}
        onClick={onSelectTool}
      >
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
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Connector tools"
          title="Line / arrow / connector"
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition-colors",
            pendingConnectorTool
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground data-popup-open:bg-foreground/6 data-popup-open:text-foreground",
          )}
        >
          <ArrowRight className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          {CONNECTOR_OPTIONS.map(({ id, label, icon: Icon, shortcut }) => (
            <DropdownMenuItem key={id} onClick={() => onArmConnectorTool(id)}>
              <Icon className="size-4" />
              {label}
              <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolButton label="Add frame (drag to draw)" active={pendingFrameTool} onClick={onArmFrameTool}>
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
