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
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
}) {
  const current = SORT_OPTIONS.find((o) => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowUpDown className="size-3.5" />
            {current?.label ?? "Sort"}
          </Button>
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
