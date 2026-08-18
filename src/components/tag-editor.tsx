"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Manual tags/collections editor — free text always works (typing a
 * brand-new name and hitting Enter creates it), but when `suggestions`
 * is passed, matching *existing* names show in a dropdown so reusing
 * one is a click instead of retyping it exactly. Same component powers
 * both the "Tags" and "Collections" fields; only the suggestion list
 * differs between call sites. */
export function TagEditor({
  tags,
  onChange,
  suggestions = [],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions.filter(
      (s) =>
        !tags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
        (!q || s.toLowerCase().includes(q)),
    );
  }, [suggestions, tags, draft]);

  function commit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...tags, trimmed]);
    }
    setDraft("");
    setIsOpen(false);
    setHighlight(0);
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="h-7 gap-1 px-2.5 pr-1.5 text-sm">
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setHighlight(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && filtered.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h + 1) % filtered.length);
            setIsOpen(true);
          } else if (e.key === "ArrowUp" && filtered.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
            setIsOpen(true);
          } else if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (isOpen && filtered[highlight]) commit(filtered[highlight]);
            else commit(draft);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          // commit() early-returns for an empty draft (nothing to add)
          // before it reaches its own setIsOpen(false) — closing here
          // unconditionally is what actually dismisses the dropdown
          // when clicking away without having typed anything.
          commit(draft);
          setIsOpen(false);
        }}
        placeholder="Add tag…"
        className="h-7 w-28 border-dashed text-sm"
      />

      {isOpen && filtered.length > 0 && (
        <div className="glass-panel absolute left-0 top-full z-20 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg p-1">
          {filtered.slice(0, 8).map((s, i) => (
            <button
              key={s}
              type="button"
              // mousedown (not click) so this fires before the input's
              // own onBlur — otherwise the dropdown would already be
              // closed by the time a click event reached it.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
                inputRef.current?.focus();
              }}
              className={cn(
                "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
                i === highlight ? "bg-foreground/10" : "hover:bg-foreground/6",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
