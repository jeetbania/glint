"use client";

import { ArrowUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type SortValue = "recent-desc" | "recent-asc" | "name-asc";

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "recent-desc", label: "Most recent" },
  { value: "recent-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
];

export function SortMenu({
  value,
  onChange,
  compact = false,
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
  /** Icon-only trigger (no label text) for narrow contexts — the Notes/
   * Tasks list column, at 320px total, doesn't have room next to the
   * search box for a labeled button the way the Library toolbar does. */
  compact?: boolean;
}) {
  const current = SORT_OPTIONS.find((o) => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          compact ? (
            <Button size="icon-sm" variant="outline" aria-label={`Sort: ${current?.label ?? "Sort"}`}>
              <ArrowUpDown className="size-3.5" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5">
              <ArrowUpDown className="size-3.5" />
              {current?.label ?? "Sort"}
            </Button>
          )
        }
      />
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.value === value && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
