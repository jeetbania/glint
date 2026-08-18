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
  Slash,
  ArrowUpRight,
  CornerDownRight,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  ApiCanvasObject,
  CanvasFontFamily,
  CanvasShapeVariant,
  CanvasTextAlign,
} from "@/types/canvas-object";

const SHAPE_VARIANT_ICON: Record<CanvasShapeVariant, typeof Square> = {
  rectangle: Square,
  ellipse: Circle,
  triangle: Triangle,
  line: Slash,
  arrow: ArrowUpRight,
  "elbow-arrow": CornerDownRight,
};
const SHAPE_VARIANT_LABEL: Record<CanvasShapeVariant, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  line: "Line",
  arrow: "Arrow",
  "elbow-arrow": "Elbow arrow",
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
  onDelete,
  style,
}: {
  obj: ApiCanvasObject;
  onChange: (patch: CanvasObjectPatch) => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}) {
  const hasText = obj.type === "sticky" || obj.type === "text";
  const hasFill = obj.type === "sticky" || obj.type === "shape" || obj.type === "frame";
  const isStrokeShape =
    obj.type === "shape" &&
    (obj.shapeVariant === "line" || obj.shapeVariant === "arrow" || obj.shapeVariant === "elbow-arrow");
  const swatches = obj.type === "shape" ? TEXT_COLORS.concat(NOTE_COLORS) : NOTE_COLORS;

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
          const variant = obj.shapeVariant ?? "rectangle";
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
                  <DropdownMenuSeparator />
                  {(["line", "arrow", "elbow-arrow"] as const).map((v) => {
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

      {hasFill && (
        <ColorSwatchPicker
          label={obj.type === "sticky" ? "Note color" : isStrokeShape ? "Stroke color" : "Fill color"}
          value={obj.fill ?? NOTE_COLORS[0]}
          colors={swatches}
          onChange={(fill) => onChange({ fill })}
        />
      )}

      <span className="mx-0.5 h-4 w-px bg-border" />

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
