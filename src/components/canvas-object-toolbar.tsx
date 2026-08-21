"use client";

import { useState } from "react";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Square,
  Circle,
  Triangle,
  Diamond,
  Ban,
  ArrowRight,
  Minus,
  MoreHorizontal,
  Spline,
  CornerDownRight,
  Type,
  FlipHorizontal,
  FlipVertical,
  CopyPlus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  ApiCanvasObject,
  CanvasFontFamily,
  CanvasTextAlign,
  CanvasConnectorDecoration,
  CanvasConnectorType,
  CanvasConnectorStrokeStyle,
} from "@/types/canvas-object";

const DECORATION_ICON: Record<CanvasConnectorDecoration, typeof Ban> = {
  none: Ban,
  arrow: Triangle,
  line: ArrowRight,
  circle: Circle,
  diamond: Diamond,
};
const DECORATION_LABEL: Record<CanvasConnectorDecoration, string> = {
  none: "None",
  arrow: "Arrow",
  line: "Line arrow",
  circle: "Circle",
  diamond: "Diamond",
};
const CONNECTOR_TYPE_ICON: Record<CanvasConnectorType, typeof Minus> = {
  straight: Minus,
  curved: Spline,
  elbow: CornerDownRight,
};
const CONNECTOR_TYPE_LABEL: Record<CanvasConnectorType, string> = {
  straight: "Straight",
  curved: "Curved",
  elbow: "Elbow",
};
const STROKE_STYLE_ICON: Record<CanvasConnectorStrokeStyle, typeof Minus> = {
  solid: Minus,
  dashed: MoreHorizontal,
};
const STROKE_STYLE_LABEL: Record<CanvasConnectorStrokeStyle, string> = {
  solid: "Solid",
  dashed: "Dashed",
};

// Only the three real (non-connector) shape variants are choosable from
// this toolbar's dropdown below — "line"/"arrow"/"elbow-arrow" are
// legacy values CanvasShapeVariant still carries only so old stored rows
// type-check through lib/local/canvas-objects.ts's one-time migration to
// a real connector object; nothing creates them anymore.
const SHAPE_VARIANT_ICON: Record<"rectangle" | "ellipse" | "triangle", typeof Square> = {
  rectangle: Square,
  ellipse: Circle,
  triangle: Triangle,
};
const SHAPE_VARIANT_LABEL: Record<"rectangle" | "ellipse" | "triangle", string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
};

const FONT_FAMILY_LABEL: Record<CanvasFontFamily, string> = {
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
};
export const FONT_FAMILY_CSS: Record<CanvasFontFamily, string> = {
  sans: "var(--font-sans)",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace",
};

const NOTE_COLORS = [
  "#FDE68A", // yellow (default)
  "#FBCFE8", // pink
  "#BFDBFE", // blue
  "#BBF7D0", // green
  "#DDD6FE", // lavender
  "#FED7AA", // orange
  "#E5E7EB", // gray
];
const TEXT_COLORS = ["#17171A", "#FFFFFF", "#6F6E66", "#3B5BDB", "#DC2626", "#16A34A"];

export type CanvasObjectPatch = Partial<
  Pick<
    ApiCanvasObject,
    | "fontFamily"
    | "fontSize"
    | "bold"
    | "italic"
    | "align"
    | "textColor"
    | "fill"
    | "shapeVariant"
    | "text"
    | "rotation"
    | "flipX"
    | "flipY"
    // x/y/w/h aren't set by any control in this toolbar directly — they
    // ride along only when collection-canvas.tsx's handleObjectStyleChange
    // derives a new bounding box as a side effect of a connector's
    // `points` changing, or (legacy) a shapeVariant switch's box nudge.
    | "x"
    | "y"
    | "w"
    | "h"
    // connector-only — set via the decoration controls below, or by
    // collection-canvas.tsx's own endpoint/segment/body drag handlers
    // (not through this toolbar's UI directly).
    | "points"
    | "connectorType"
    | "startDecoration"
    | "endDecoration"
    | "strokeStyle"
    | "startBinding"
    | "endBinding"
    // any object type — set via collection-canvas.tsx's context menu,
    // not through this toolbar's UI.
    | "locked"
  >
>;

/** The floating rich toolbar shown above a selected sticky/text/shape
 * object — see the reference: font family, size, bold/italic, alignment,
 * text color, and a fill/note-color swatch. Which controls appear
 * depends on the object's type (a plain "text" object has no fill; a
 * "shape" has no text controls at all). */
export function CanvasObjectToolbar({
  obj,
  onChange,
  onFlip,
  onAddLabel,
  onDuplicate,
  onDelete,
  style,
}: {
  obj: ApiCanvasObject;
  onChange: (patch: CanvasObjectPatch) => void;
  onFlip: (axis: "horizontal" | "vertical") => void;
  onAddLabel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}) {
  const hasText = obj.type === "sticky" || obj.type === "text";
  // Connectors reuse the same `fill` field as their stroke color (see
  // the decoration controls below for their other, connector-specific
  // controls).
  const hasFill = obj.type === "sticky" || obj.type === "shape" || obj.type === "frame" || obj.type === "connector";
  const swatches = obj.type === "shape" || obj.type === "connector" ? TEXT_COLORS.concat(NOTE_COLORS) : NOTE_COLORS;

  return (
    <div
      style={style}
      className="glass-pill pointer-events-auto absolute flex items-center gap-1 whitespace-nowrap p-1"
      // Stop drag-select/pan handlers on the canvas below from firing
      // when interacting with the toolbar itself.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {hasText && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-foreground hover:bg-foreground/6">
              {FONT_FAMILY_LABEL[obj.fontFamily]}
              <ChevronDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuRadioGroup
                value={obj.fontFamily}
                onValueChange={(v) => onChange({ fontFamily: v as CanvasFontFamily })}
              >
                {(Object.keys(FONT_FAMILY_LABEL) as CanvasFontFamily[]).map((f) => (
                  <DropdownMenuRadioItem key={f} value={f}>
                    <span style={{ fontFamily: FONT_FAMILY_CSS[f] }}>
                      {FONT_FAMILY_LABEL[f]}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-0.5 h-4 w-px bg-border" />

          <FontSizeStepper
            value={obj.fontSize}
            onChange={(fontSize) => onChange({ fontSize })}
          />

          <span className="mx-0.5 h-4 w-px bg-border" />

          <ToolbarToggle
            label="Bold"
            active={obj.bold}
            onClick={() => onChange({ bold: !obj.bold })}
          >
            <Bold className="size-3.5" />
          </ToolbarToggle>
          <ToolbarToggle
            label="Italic"
            active={obj.italic}
            onClick={() => onChange({ italic: !obj.italic })}
          >
            <Italic className="size-3.5" />
          </ToolbarToggle>

          <span className="mx-0.5 h-4 w-px bg-border" />

          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as [CanvasTextAlign, typeof AlignLeft][]
          ).map(([align, Icon]) => (
            <ToolbarToggle
              key={align}
              label={`Align ${align}`}
              active={obj.align === align}
              onClick={() => onChange({ align })}
            >
              <Icon className="size-3.5" />
            </ToolbarToggle>
          ))}

          <span className="mx-0.5 h-4 w-px bg-border" />

          <ColorSwatchPicker
            label="Text color"
            value={obj.textColor ?? "#17171A"}
            colors={TEXT_COLORS}
            onChange={(textColor) => onChange({ textColor })}
            icon="A"
          />
        </>
      )}

      {obj.type === "shape" &&
        (() => {
          const variant = (obj.shapeVariant ?? "rectangle") as "rectangle" | "ellipse" | "triangle";
          const Icon = SHAPE_VARIANT_ICON[variant];
          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-7 items-center gap-1 rounded-full px-2 hover:bg-foreground/6">
                  <Icon className="size-3.5" />
                  <ChevronDown className="size-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {(["rectangle", "ellipse", "triangle"] as const).map((v) => {
                    const ItemIcon = SHAPE_VARIANT_ICON[v];
                    return (
                      <DropdownMenuItem key={v} onClick={() => onChange({ shapeVariant: v })}>
                        <ItemIcon className="size-4" />
                        {SHAPE_VARIANT_LABEL[v]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="mx-0.5 h-4 w-px bg-border" />
            </>
          );
        })()}

      {obj.type === "connector" && (
        <>
          {/* Text label — a connector has no box for a body of text to
              live in, so this doesn't join the hasText controls above;
              it just focuses (creating, if there wasn't one yet) a
              label centered on the connector's own path. */}
          <button
            type="button"
            aria-label="Add label"
            title="Add label"
            onClick={onAddLabel}
            className="flex h-7 items-center justify-center rounded-full px-2 text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
          >
            <Type className="size-3.5" />
          </button>

          <span className="mx-0.5 h-4 w-px bg-border" />

          <IconPickerDropdown
            label="Stroke style"
            value={obj.strokeStyle ?? "solid"}
            options={["solid", "dashed"] as const}
            icons={STROKE_STYLE_ICON}
            labels={STROKE_STYLE_LABEL}
            onChange={(strokeStyle) => onChange({ strokeStyle })}
          />

          <IconPickerDropdown
            label="Connector style"
            value={obj.connectorType ?? "straight"}
            options={["straight", "curved", "elbow"] as const}
            icons={CONNECTOR_TYPE_ICON}
            labels={CONNECTOR_TYPE_LABEL}
            onChange={(connectorType) => onChange({ connectorType })}
          />

          {/* Start/end decoration — this IS "line" vs "arrow" vs
              "two-way arrow" now: all three are the exact same
              underlying object, just with these two independently set —
              each end has its own full picker (none/arrow/line arrow/
              circle/diamond), not just a plain on-off toggle. */}
          <IconPickerDropdown
            label="Start decoration"
            value={obj.startDecoration ?? "none"}
            options={["none", "arrow", "line", "circle", "diamond"] as const}
            icons={DECORATION_ICON}
            labels={DECORATION_LABEL}
            iconFlip
            onChange={(startDecoration) => onChange({ startDecoration })}
          />
          <IconPickerDropdown
            label="End decoration"
            value={obj.endDecoration ?? "none"}
            options={["none", "arrow", "line", "circle", "diamond"] as const}
            icons={DECORATION_ICON}
            labels={DECORATION_LABEL}
            onChange={(endDecoration) => onChange({ endDecoration })}
          />

          <span className="mx-0.5 h-4 w-px bg-border" />
        </>
      )}

      {hasFill && (
        <ColorSwatchPicker
          label={obj.type === "sticky" ? "Note color" : obj.type === "connector" ? "Stroke color" : "Fill color"}
          value={obj.fill ?? NOTE_COLORS[0]}
          colors={swatches}
          onChange={(fill) => onChange({ fill })}
        />
      )}

      <span className="mx-0.5 h-4 w-px bg-border" />

      {/* Flip routes through the parent's onFlip rather than setting
          flipX/flipY directly — a connector's "flip" mirrors its real
          points (see flipConnectorPoints in collection-canvas.tsx)
          instead, so it has no persisted on/off state of its own; the
          button always shows unpressed for one, a real toggle for
          everything else. */}
      <ToolbarToggle
        label="Flip horizontal"
        active={obj.type !== "connector" && !!obj.flipX}
        onClick={() => onFlip("horizontal")}
      >
        <FlipHorizontal className="size-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        label="Flip vertical"
        active={obj.type !== "connector" && !!obj.flipY}
        onClick={() => onFlip("vertical")}
      >
        <FlipVertical className="size-3.5" />
      </ToolbarToggle>

      <span className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        aria-label="Duplicate"
        title="Duplicate (⌘D)"
        onClick={onDuplicate}
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
      >
        <CopyPlus className="size-3.5" />
      </button>

      <button
        type="button"
        aria-label="Delete"
        title="Delete"
        onClick={onDelete}
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function FontSizeStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.min(200, Math.max(8, n));
  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="h-7 w-10 rounded-full bg-transparent text-center text-xs tabular-nums text-foreground outline-none hover:bg-foreground/6 focus:bg-foreground/6"
      />
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Increase font size"
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-3.5 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Decrease font size"
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-3.5 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  );
}

/** A small icon-only dropdown that picks one value out of a fixed set —
 * the shared shape behind the connector toolbar's stroke-style,
 * connector-style, and start/end-decoration pickers (each just a
 * different options/icons/labels triple). */
function IconPickerDropdown<T extends string>({
  label,
  value,
  options,
  icons,
  labels,
  iconFlip,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  icons: Record<T, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>;
  labels: Record<T, string>;
  /** Mirrors the TRIGGER's own icon horizontally (cosmetic only — e.g.
   * the start-decoration picker showing its arrow pointing left, to
   * read as "this end", while the end picker's points right). */
  iconFlip?: boolean;
  onChange: (value: T) => void;
}) {
  // TS can't narrow Record<T, X>[T] to X for a generic T well enough to
  // use directly as a JSX tag — the runtime value genuinely is that
  // shape (a plain icon component), so this is just satisfying the
  // type-checker, not asserting anything false.
  type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  const Icon = icons[value] as IconType;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className="flex h-7 items-center gap-1 rounded-full px-2 hover:bg-foreground/6"
      >
        <Icon className="size-3.5" style={iconFlip ? { transform: "scaleX(-1)" } : undefined} />
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {options.map((opt) => {
          const ItemIcon = icons[opt] as IconType;
          return (
            <DropdownMenuItem key={opt} onClick={() => onChange(opt)}>
              <ItemIcon className="size-4" />
              {labels[opt]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToolbarToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ColorSwatchPicker({
  label,
  value,
  colors,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  colors: string[];
  onChange: (color: string) => void;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        title={label}
        className="flex h-7 items-center gap-1 rounded-full px-1.5 hover:bg-foreground/6"
      >
        {icon && (
          <span className="text-xs font-semibold" style={{ color: value }}>
            {icon}
          </span>
        )}
        <span
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: value }}
        />
        <ChevronDown className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" sideOffset={10}>
        <div className="flex flex-wrap gap-1.5" style={{ maxWidth: 168 }}>
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={cn(
                "size-6 rounded-full border transition-transform hover:scale-110",
                c.toUpperCase() === value.toUpperCase()
                  ? "border-foreground ring-2 ring-foreground/30"
                  : "border-black/10",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="relative flex size-6 items-center justify-center overflow-hidden rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground">
            <span className="text-[10px] leading-none">+</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
