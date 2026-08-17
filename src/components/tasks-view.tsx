"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  CheckSquare,
  Folder,
  Plus,
  Search,
  Sun,
  CheckCircle2,
  Trash2,
  Pencil,
  Maximize2,
  MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { NoteEditor } from "@/components/note-editor";
import { TagEditor } from "@/components/tag-editor";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useCollectionActions } from "@/lib/use-collection-actions";
import { useItemActions } from "@/lib/use-item-actions";
import { useSound } from "@/lib/use-sound";
import { triggerConfetti } from "@/lib/confetti";
import { hueForIndex, hueSwatch } from "@/lib/folder-color";
import { useCollectionNames, useTagNames } from "@/lib/use-suggestions";
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
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatNoteTimestamp, isToday } from "@/lib/date-groups";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";
import type { JSONContent } from "@tiptap/react";

/** "all"/"today"/"completed" are smart views; anything else is a
 * Collection slug (a "List", reusing the exact same folder-membership
 * mechanism Notes already uses) — the Things 3 layout translated onto
 * what this app actually has. */
type SidebarView = "all" | "today" | "completed" | string;

type CollectionPreview = { id: string; name: string; slug: string; count: number };

/** Things-3-style three-pane layout for tasks: a sidebar of smart views
 * + Lists (Collections), a checkbox list of tasks in the current view,
 * and an inline detail pane with tags/lists and a rich checklist body —
 * the same NoteEditor Notes uses, since a Things "project" section
 * (a titled checklist) is exactly a Tiptap taskList under a heading. */
export function TasksView() {
  const { data: collectionsData } = useSWR<{ collections: CollectionPreview[] }>(
    "/api/collections",
  );
  const { data: tasksData, mutate: mutateTasks } = useSWR<{ items: ApiItem[] }>(
    "/api/items?type=task",
  );
  const { mutate: globalMutate } = useSWRConfig();
  const play = useSound();

  const [view, setView] = useState<SidebarView>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [listDraft, setListDraft] = useState("");

  const collections = collectionsData?.collections ?? [];
  const allTasks = useMemo(() => tasksData?.items ?? [], [tasksData]);
  const openTasks = useMemo(() => allTasks.filter((t) => !t.completed), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter((t) => t.completed), [allTasks]);
  const todayTasks = useMemo(
    () => openTasks.filter((t) => isToday(t.createdAt)),
    [openTasks],
  );

  const listTasks = useMemo(() => {
    if (view === "all") return openTasks;
    if (view === "today") return todayTasks;
    if (view === "completed") return completedTasks;
    return allTasks.filter((t) => t.collections.some((c) => c.slug === view));
  }, [allTasks, openTasks, todayTasks, completedTasks, view]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listTasks;
    return listTasks.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) || t.bodyText?.toLowerCase().includes(q),
    );
  }, [listTasks, search]);

  // Open tasks first (most recent first), completed sink to the bottom
  // struck-through — same convention Things uses inside a List, rather
  // than vanishing them entirely (that's what the dedicated "Completed"
  // smart view is for).
  const sortedTasks = useMemo(() => {
    const open = visibleTasks.filter((t) => !t.completed);
    const done = visibleTasks.filter((t) => t.completed);
    return [...open, ...done];
  }, [visibleTasks]);

  const selected = allTasks.find((t) => t.id === selectedId) ?? null;

  const refreshLibrary = () =>
    globalMutate((key) => typeof key === "string" && key.startsWith("/api/items"));

  async function toggleComplete(task: ApiItem, e?: React.MouseEvent) {
    const next = !task.completed;
    void mutateTasks(
      (current) => {
        if (!current) return current;
        return {
          items: current.items.map((t) =>
            t.id === task.id ? { ...t, completed: next } : t,
          ),
        };
      },
      { revalidate: false },
    );
    if (next) {
      play("success");
      if (e) triggerConfetti(e.clientX, e.clientY);
    }
    await fetch(`/api/items/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    void mutateTasks();
    refreshLibrary();
  }

  async function submitCreateList() {
    const name = listDraft.trim();
    setCreatingList(false);
    setListDraft("");
    if (!name) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    void globalMutate("/api/collections");
  }

  async function fileTaskIntoList(taskId: string, list: CollectionPreview) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.collections.some((c) => c.slug === list.slug)) return;
    const names = [...task.collections.map((c) => c.name), list.name];
    await fetch(`/api/items/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collections: names }),
    });
    toast.success(`Moved to "${list.name}"`);
    mutateTasks();
    refreshLibrary();
    void globalMutate("/api/collections");
  }

  async function createTask() {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "task", title: "" }),
    });
    const { item } = (await res.json()) as { item: ApiItem };
    if (view !== "all" && view !== "today" && view !== "completed") {
      const list = collections.find((c) => c.slug === view);
      if (list) {
        await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collections: [list.name] }),
        });
        void globalMutate("/api/collections");
      }
    }
    mutateTasks();
    refreshLibrary();
    setSelectedId(item.id);
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border/60 px-3 py-4">
        <div className="space-y-0.5">
          <ListRow
            label="All Tasks"
            icon={CheckSquare}
            count={openTasks.length}
            active={view === "all"}
            onClick={() => setView("all")}
          />
          <ListRow
            label="Today"
            icon={Sun}
            iconColor="oklch(70% 0.15 70)"
            count={todayTasks.length}
            active={view === "today"}
            onClick={() => setView("today")}
          />
          <ListRow
            label="Completed"
            icon={CheckCircle2}
            iconColor="oklch(68% 0.15 150)"
            count={completedTasks.length}
            active={view === "completed"}
            onClick={() => setView("completed")}
          />
        </div>

        <div>
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-xs font-medium text-muted-foreground">Lists</p>
            <button
              type="button"
              onClick={() => setCreatingList(true)}
              aria-label="New list"
              className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {collections.map((c, i) => (
              <ListRow
                key={c.id}
                label={c.name}
                icon={Folder}
                iconColor={hueSwatch(hueForIndex(i))}
                count={allTasks.filter((t) => t.collections.some((oc) => oc.slug === c.slug)).length}
                active={view === c.slug}
                onClick={() => setView(c.slug)}
                collection={c}
                onDeleted={() => view === c.slug && setView("all")}
                onDropTask={(taskId) => fileTaskIntoList(taskId, c)}
              />
            ))}
          </div>
          {creatingList && (
            <input
              autoFocus
              value={listDraft}
              onChange={(e) => setListDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreateList();
                if (e.key === "Escape") {
                  setCreatingList(false);
                  setListDraft("");
                }
              }}
              onBlur={submitCreateList}
              placeholder="List name"
              className="mt-0.5 w-full rounded-lg bg-foreground/8 px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
        </div>
      </aside>

      <div className="flex w-80 shrink-0 flex-col border-r border-border/60">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h1 className="font-heading text-lg font-semibold tracking-heading">Tasks</h1>
          <div className="flex items-center gap-1.5">
            <Kbd>⌘⇧T</Kbd>
            <Button size="icon-sm" variant="outline" onClick={createTask} aria-label="New task">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {sortedTasks.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </p>
          )}
          {sortedTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              active={selectedId === task.id}
              onSelect={() => setSelectedId(task.id)}
              onToggle={(e) => toggleComplete(task, e)}
              onDeleted={() => selectedId === task.id && setSelectedId(null)}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <TaskDetailPane
            key={selected.id}
            task={selected}
            onToggle={(e) => toggleComplete(selected, e)}
            onDeleted={() => {
              setSelectedId(null);
              mutateTasks();
              refreshLibrary();
            }}
            onSaved={() => {
              mutateTasks();
              refreshLibrary();
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a task, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      aria-label={checked ? "Mark incomplete" : "Mark complete"}
      className={cn(
        "flex size-4.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50 hover:border-primary",
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
          <path
            d="M2.5 6.5L4.5 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function TaskRow({
  task,
  active,
  onSelect,
  onToggle,
  onDeleted,
}: {
  task: ApiItem;
  active: boolean;
  onSelect: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onDeleted: () => void;
}) {
  const { remove } = useItemActions();
  const actions: MenuAction[] = [
    { label: "Open", icon: Maximize2, onClick: onSelect },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: async () => {
        await remove(task);
        onDeleted();
      },
    },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", task.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={onSelect}
          className={cn(
            "flex w-full cursor-grab items-start gap-2.5 border-b border-border/40 px-4 py-2.5 text-left transition-colors active:cursor-grabbing",
            active ? "bg-foreground/8" : "hover:bg-foreground/4",
          )}
        >
          <div className="pt-0.5">
            <Checkbox checked={task.completed} onToggle={onToggle} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  task.completed && "text-muted-foreground line-through",
                )}
              >
                {task.title || "New Task"}
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatNoteTimestamp(task.updatedAt)}
              </span>
            </div>
            {task.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-foreground/6 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ListRow({
  label,
  icon: Icon,
  iconColor,
  count,
  active,
  onClick,
  collection,
  onDeleted,
  onDropTask,
}: {
  label: string;
  icon: typeof Folder;
  iconColor?: string;
  count: number;
  active: boolean;
  onClick: () => void;
  collection?: { id: string; name: string; slug: string };
  onDeleted?: () => void;
  onDropTask?: (taskId: string) => void;
}) {
  const { rename, remove } = useCollectionActions();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(label);
  const [isDropTarget, setIsDropTarget] = useState(false);

  async function submitRename() {
    setIsRenaming(false);
    if (!collection || !draft.trim() || draft.trim() === collection.name) {
      setDraft(label);
      return;
    }
    const ok = await rename(collection.id, collection.slug, draft);
    if (!ok) setDraft(label);
  }

  const row = (
    <button
      onClick={onClick}
      onDragOver={(e) => {
        if (!onDropTask) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={() => onDropTask && setIsDropTarget(true)}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(e) => {
        if (!onDropTask) return;
        e.preventDefault();
        setIsDropTarget(false);
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) onDropTask(taskId);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-foreground/8 font-medium" : "text-muted-foreground hover:bg-foreground/4 hover:text-foreground",
        isDropTarget && "bg-primary/10 ring-2 ring-primary",
      )}
    >
      <Icon
        className="size-3.5 shrink-0"
        style={iconColor ? { color: iconColor } : undefined}
      />
      {isRenaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") {
              setDraft(label);
              setIsRenaming(false);
            }
          }}
          onBlur={submitRename}
          className="min-w-0 flex-1 rounded bg-foreground/8 px-1 -mx-1 outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {count > 0 ? (
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
          style={
            iconColor
              ? {
                  backgroundColor: `color-mix(in oklch, ${iconColor} 16%, transparent)`,
                  color: iconColor,
                }
              : undefined
          }
        >
          {count}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">0</span>
      )}
    </button>
  );

  if (!collection) return row;

  const actions: MenuAction[] = [
    {
      label: "Rename",
      icon: Pencil,
      onClick: () => {
        setDraft(label);
        setIsRenaming(true);
      },
    },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => {
        remove(collection.slug, collection.name);
        onDeleted?.();
      },
    },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function TaskDetailPane({
  task,
  onToggle,
  onDeleted,
  onSaved,
}: {
  task: ApiItem;
  onToggle: (e: React.MouseEvent) => void;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const { mutate: globalMutate } = useSWRConfig();
  const { remove } = useItemActions();
  const collectionNames = useCollectionNames();
  const tagNames = useTagNames();
  const [title, setTitle] = useState(task.title ?? "");

  const saveTitle = useDebouncedCallback(async (value: string) => {
    await fetch(`/api/items/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    onSaved();
  }, 600);

  const saveChecklist = useDebouncedCallback(
    async (payload: { json: JSONContent; text: string }) => {
      await fetch(`/api/items/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyJson: payload.json, bodyText: payload.text }),
      });
      onSaved();
    },
    800,
  );

  async function saveTags(tags: string[]) {
    await fetch(`/api/items/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    onSaved();
  }

  async function saveCollections(names: string[]) {
    await fetch(`/api/items/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collections: names }),
    });
    void globalMutate("/api/collections");
    onSaved();
  }

  async function handleDelete() {
    await remove(task);
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-6 pb-2 pt-5">
        <p className="text-xs text-muted-foreground">
          Edited {formatNoteTimestamp(task.updatedAt)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" aria-label="Task options" />}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="mb-3 flex items-center gap-2.5">
          <Checkbox checked={task.completed} onToggle={onToggle} />
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              saveTitle(e.target.value);
            }}
            placeholder="Untitled"
            className={cn(
              "h-auto min-w-0 flex-1 border-none px-1 py-1 font-heading text-2xl leading-tight font-semibold tracking-heading shadow-none focus-visible:ring-0 md:text-2xl",
              task.completed && "text-muted-foreground line-through",
            )}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 pl-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Lists</span>
            <TagEditor
              tags={task.collections.map((c) => c.name)}
              onChange={saveCollections}
              suggestions={collectionNames}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Tags</span>
            <TagEditor
              tags={task.tags.map((t) => t.name)}
              onChange={saveTags}
              suggestions={tagNames}
            />
          </div>
        </div>

        <NoteEditor
          content={(task.bodyJson as JSONContent) ?? task.bodyText}
          onUpdate={saveChecklist}
        />
      </div>
    </div>
  );
}
