"use client";

import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  BringToFront,
  SendToBack,
  Trash2,
} from "lucide-react";

export type AlignEdge = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

/** Floating toolbar shown when 2+ nodes (items and/or canvas objects) are
 * selected together — align/distribute/reorder/delete, per the reference.
 * No "lock" control here yet (scoped out — would need a persisted lock
 * flag on both items and canvas objects, a bigger change than the rest
 * of this batch). */
export function CanvasAlignToolbar({
  style,
  onAlign,
  onDistribute,
  onBringToFront,
  onSendToBack,
  onDelete,
}: {
  style?: React.CSSProperties;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={style}
      className="glass-pill pointer-events-auto absolute flex items-center gap-1 p-1"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Btn label="Align left" onClick={() => onAlign("left")}>
        <AlignHorizontalJustifyStart className="size-3.5" />
      </Btn>
      <Btn label="Align center" onClick={() => onAlign("center-h")}>
        <AlignHorizontalJustifyCenter className="size-3.5" />
      </Btn>
      <Btn label="Align right" onClick={() => onAlign("right")}>
        <AlignHorizontalJustifyEnd className="size-3.5" />
      </Btn>

      <span className="mx-0.5 h-4 w-px bg-border" />

      <Btn label="Align top" onClick={() => onAlign("top")}>
        <AlignVerticalJustifyStart className="size-3.5" />
      </Btn>
      <Btn label="Align middle" onClick={() => onAlign("center-v")}>
        <AlignVerticalJustifyCenter className="size-3.5" />
      </Btn>
      <Btn label="Align bottom" onClick={() => onAlign("bottom")}>
        <AlignVerticalJustifyEnd className="size-3.5" />
      </Btn>

      <span className="mx-0.5 h-4 w-px bg-border" />

      <Btn label="Distribute horizontally" onClick={() => onDistribute("horizontal")}>
        <AlignHorizontalDistributeCenter className="size-3.5" />
      </Btn>
      <Btn label="Distribute vertically" onClick={() => onDistribute("vertical")}>
        <AlignVerticalDistributeCenter className="size-3.5" />
      </Btn>

      <span className="mx-0.5 h-4 w-px bg-border" />

      <Btn label="Bring to front" onClick={onBringToFront}>
        <BringToFront className="size-3.5" />
      </Btn>
      <Btn label="Send to back" onClick={onSendToBack}>
        <SendToBack className="size-3.5" />
      </Btn>

      <span className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        aria-label="Delete selection"
        title="Delete selection"
        onClick={onDelete}
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function Btn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
    >
      {children}
    </button>
  );
}
