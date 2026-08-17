"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSound } from "@/lib/use-sound";
import { triggerConfetti } from "@/lib/confetti";
import { useItemActions } from "@/lib/use-item-actions";
import { renderMenuActions, type MenuAction } from "@/components/ui/menu-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ItemDetailDialog } from "@/components/item-detail-dialog";
import type { ApiItem } from "@/types/item";

type Column = { id: string; name: string; sortOrder: number; color: string | null };
type Card = { id: string; columnId: string; sortOrder: string; item: ApiItem };
type Board = { columns: Column[]; cards: Card[] };

const isDoneColumn = (name: string) => name.trim().toLowerCase() === "done";

/** A Linear/Todoist-style kanban board for task items — columns are
 * user-defined (three seeded by default: Todo, In Progress, Done),
 * cards are task items, and dropping a card into a column named "Done"
 * is the one moment in the whole app that gets a real celebration
 * (confetti + sound), since finishing a task is exactly the kind of
 * outcome worth marking. Every "type a name" moment (new task, rename
 * column, new column) is an inline autofocus input, never
 * window.prompt() — a native prompt blocks the whole page (and, not
 * incidentally, any automated testing against it) until dismissed. */
export function KanbanBoard() {
  const { data, mutate } = useSWR<Board>("/api/kanban");
  const play = useSound();
  const { remove } = useItemActions();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [creatingColumn, setCreatingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState("");
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  // Shared across every column, not per-column state — a card dragged
  // out of one column and dropped on a *different* column's body or
  // card needs the SAME ref both sides read/write, otherwise the drop
  // target's own (empty) ref never sees which card is being dragged.
  const dragCardRef = useRef<Card | null>(null);

  const columns = data?.columns ?? [];
  const cards = useMemo(() => data?.cards ?? [], [data?.cards]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of cards) {
      const list = map.get(card.columnId) ?? [];
      list.push(card);
      map.set(card.columnId, list);
    }
    return map;
  }, [cards]);

  async function moveCard(
    card: Card,
    targetColumn: Column,
    beforeOrder: string | null,
    afterOrder: string | null,
    dropEvent?: React.DragEvent,
  ) {
    const wasInDone = columns.find((c) => c.id === card.columnId)?.name;
    const movingIntoDone = isDoneColumn(targetColumn.name) && !isDoneColumn(wasInDone ?? "");

    // Optimistic local reorder so the drop feels instant — the server
    // call still runs, but the UI doesn't wait on it.
    void mutate(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          cards: current.cards.map((c) =>
            c.id === card.id ? { ...c, columnId: targetColumn.id } : c,
          ),
        };
      },
      { revalidate: false },
    );

    if (movingIntoDone) {
      play("success");
      if (dropEvent) triggerConfetti(dropEvent.clientX, dropEvent.clientY);
    } else {
      play("select");
    }

    await fetch(`/api/kanban/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: targetColumn.id, beforeOrder, afterOrder }),
    });
    void mutate();
  }

  async function submitCreateTask(columnId: string, title: string) {
    setAddingTaskTo(null);
    if (!title.trim()) return;
    await fetch("/api/kanban/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, title: title.trim() }),
    });
    play("success");
    void mutate();
  }

  async function submitCreateColumn() {
    const name = columnDraft.trim();
    setCreatingColumn(false);
    setColumnDraft("");
    if (!name) return;
    await fetch("/api/kanban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    void mutate();
  }

  async function submitRenameColumn(column: Column, name: string) {
    if (!name.trim() || name.trim() === column.name) return;
    await fetch(`/api/kanban/columns/${column.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    void mutate();
  }

  async function deleteColumnConfirmed(column: Column) {
    await fetch(`/api/kanban/columns/${column.id}`, { method: "DELETE" });
    toast.success(`Deleted "${column.name}"`);
    void mutate();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-6">
        <h1 className="font-heading text-lg font-semibold tracking-heading">Tasks</h1>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-4 overflow-x-auto px-6 pb-6">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={cardsByColumn.get(column.id) ?? []}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
            dragCardRef={dragCardRef}
            onDropCard={moveCard}
            isAddingTask={addingTaskTo === column.id}
            onStartAddTask={() => setAddingTaskTo(column.id)}
            onSubmitTask={(title) => submitCreateTask(column.id, title)}
            onCancelAddTask={() => setAddingTaskTo(null)}
            onRename={(name) => submitRenameColumn(column, name)}
            onDelete={() => deleteColumnConfirmed(column)}
            onOpenItem={setSelectedItemId}
            onDeleteItem={(item) => remove(item)}
          />
        ))}

        {creatingColumn ? (
          <div className="glass-panel flex w-72 shrink-0 flex-col gap-2 rounded-2xl p-3">
            <input
              autoFocus
              value={columnDraft}
              onChange={(e) => setColumnDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreateColumn();
                if (e.key === "Escape") {
                  setCreatingColumn(false);
                  setColumnDraft("");
                }
              }}
              onBlur={submitCreateColumn}
              placeholder="Column name"
              className="rounded-lg bg-foreground/8 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreatingColumn(true)}
            className="flex w-72 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            <Plus className="size-4" />
            Add column
          </button>
        )}
      </div>

      <ItemDetailDialog
        itemId={selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </div>
  );
}

function KanbanColumn({
  column,
  cards,
  draggingId,
  setDraggingId,
  dragCardRef,
  onDropCard,
  isAddingTask,
  onStartAddTask,
  onSubmitTask,
  onCancelAddTask,
  onRename,
  onDelete,
  onOpenItem,
  onDeleteItem,
}: {
  column: Column;
  cards: Card[];
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dragCardRef: React.RefObject<Card | null>;
  onDropCard: (
    card: Card,
    column: Column,
    beforeOrder: string | null,
    afterOrder: string | null,
    e?: React.DragEvent,
  ) => void;
  isAddingTask: boolean;
  onStartAddTask: () => void;
  onSubmitTask: (title: string) => void;
  onCancelAddTask: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onOpenItem: (id: string) => void;
  onDeleteItem: (item: ApiItem) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(column.name);
  const [taskDraft, setTaskDraft] = useState("");

  const actions: MenuAction[] = [
    {
      label: "Rename",
      icon: Pencil,
      onClick: () => {
        setRenameDraft(column.name);
        setIsRenaming(true);
      },
    },
    { label: "Delete column", icon: Trash2, variant: "destructive", onClick: onDelete },
  ];

  function submitRename() {
    setIsRenaming(false);
    onRename(renameDraft);
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: column.color ?? "var(--muted-foreground)" }}
          />
          {isRenaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setRenameDraft(column.name);
                  setIsRenaming(false);
                }
              }}
              onBlur={submitRename}
              className="min-w-0 flex-1 rounded bg-foreground/8 px-1 -mx-1 text-sm font-medium outline-none"
            />
          ) : (
            <p className="truncate text-sm font-medium">{column.name}</p>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">{cards.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onStartAddTask}
            aria-label={`New task in ${column.name}`}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`More options for ${column.name}`}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {renderMenuActions(actions, DropdownMenuItem, () => null)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          const card = dragCardRef.current;
          if (!card) return;
          onDropCard(card, column, cards.at(-1)?.sortOrder ?? null, null, e);
        }}
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl p-1.5 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-primary/40",
        )}
      >
        {isAddingTask && (
          <input
            autoFocus
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSubmitTask(taskDraft);
                setTaskDraft("");
              }
              if (e.key === "Escape") {
                onCancelAddTask();
                setTaskDraft("");
              }
            }}
            onBlur={() => {
              onSubmitTask(taskDraft);
              setTaskDraft("");
            }}
            placeholder="Task name"
            className="glass-panel w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
        {cards.map((card, i) => (
          <KanbanCard
            key={card.id}
            card={card}
            dragging={draggingId === card.id}
            onDragStart={() => {
              dragCardRef.current = card;
              setDraggingId(card.id);
            }}
            onDragEnd={() => setDraggingId(null)}
            onDropBefore={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOver(false);
              const dragged = dragCardRef.current;
              if (!dragged || dragged.id === card.id) return;
              const prev = cards[i - 1];
              onDropCard(dragged, column, prev?.sortOrder ?? null, card.sortOrder, e);
            }}
            onOpen={() => onOpenItem(card.item.id)}
            onDelete={() => onDeleteItem(card.item)}
          />
        ))}
        {cards.length === 0 && !isAddingTask && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nothing here yet.
          </p>
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onOpen,
  onDelete,
}: {
  card: Card;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: (e: React.DragEvent) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { item } = card;
  const actions: MenuAction[] = [
    { label: "Open", icon: Maximize2, onClick: onOpen },
    { label: "Delete", icon: Trash2, variant: "destructive", onClick: onDelete },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropBefore}
          onClick={onOpen}
          className={cn(
            "glass-panel cursor-grab space-y-1.5 rounded-xl p-3 text-left transition-[opacity,transform] active:cursor-grabbing",
            dragging && "opacity-40",
          )}
        >
          <p className="text-sm font-medium">{item.title || "Untitled task"}</p>
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, () => null)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
