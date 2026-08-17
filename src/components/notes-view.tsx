"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Folder,
  Plus,
  Search,
  StickyNote,
  Sun,
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
import { hueForIndex, hueSwatch } from "@/lib/folder-color";
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
import { groupByDate, formatNoteTimestamp, isToday } from "@/lib/date-groups";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";
import type { JSONContent } from "@tiptap/react";

/** "all" and "today" are smart views; anything else is a Collection
 * slug — same three-tier structure as Things' Inbox/Today + custom
 * Lists, translated into what this app actually has (folders, not
 * areas/projects). */
type SidebarView = "all" | "today" | string;

type CollectionPreview = { id: string; name: string; slug: string; count: number };

/** Apple Notes-style three-pane layout: a sidebar of folders (Collections
 * reused, since a note filing into a folder is exactly the same
 * membership as an image filing into one), a date-grouped list of notes
 * in the current folder, and an inline editor pane — no modal, no
 * separate detail route. */
export function NotesView() {
  const { data: collectionsData } = useSWR<{ collections: CollectionPreview[] }>(
    "/api/collections",
  );
  const { data: notesData, mutate: mutateNotes } = useSWR<{ items: ApiItem[] }>(
    "/api/items?type=note",
  );
  const { mutate: globalMutate } = useSWRConfig();

  const [view, setView] = useState<SidebarView>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const collections = collectionsData?.collections ?? [];

  const allNotes = useMemo(() => notesData?.items ?? [], [notesData]);
  const todayNotes = useMemo(
    () => allNotes.filter((n) => isToday(n.updatedAt)),
    [allNotes],
  );

  const folderNotes = useMemo(() => {
    if (view === "all") return allNotes;
    if (view === "today") return todayNotes;
    return allNotes.filter((n) => n.collections.some((c) => c.slug === view));
  }, [allNotes, todayNotes, view]);

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folderNotes;
    return folderNotes.filter(
      (n) =>
        n.title?.toLowerCase().includes(q) || n.bodyText?.toLowerCase().includes(q),
    );
  }, [folderNotes, search]);

  const grouped = useMemo(
    () => groupByDate(visibleNotes, (n) => n.updatedAt),
    [visibleNotes],
  );

  const selected = allNotes.find((n) => n.id === selectedId) ?? null;

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");

  const refreshLibrary = () =>
    globalMutate((key) => typeof key === "string" && key.startsWith("/api/items"));

  async function submitCreateFolder() {
    const name = folderDraft.trim();
    setCreatingFolder(false);
    setFolderDraft("");
    if (!name) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    void globalMutate("/api/collections");
  }

  /** Drag a note from the list onto a folder in the sidebar to file it —
   * adds to that folder's membership without removing any it's already
   * in, mirroring how tags/collections already work as a many-to-many
   * set rather than a single parent. */
  async function fileNoteIntoFolder(noteId: string, folder: CollectionPreview) {
    const note = allNotes.find((n) => n.id === noteId);
    if (!note) return;
    if (note.collections.some((c) => c.slug === folder.slug)) return;
    const names = [...note.collections.map((c) => c.name), folder.name];
    await fetch(`/api/items/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collections: names }),
    });
    toast.success(`Moved to "${folder.name}"`);
    mutateNotes();
    refreshLibrary();
    void globalMutate("/api/collections");
  }

  async function createNote() {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", title: "" }),
    });
    const { item } = (await res.json()) as { item: ApiItem };
    if (view !== "all" && view !== "today") {
      const folder = collections.find((c) => c.slug === view);
      if (folder) {
        await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collections: [folder.name] }),
        });
        void globalMutate("/api/collections");
      }
    }
    mutateNotes();
    refreshLibrary();
    setSelectedId(item.id);
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border/60 px-3 py-4">
        <div className="space-y-0.5">
          <FolderRow
            label="All Notes"
            icon={StickyNote}
            count={allNotes.length}
            active={view === "all"}
            onClick={() => setView("all")}
          />
          <FolderRow
            label="Today"
            icon={Sun}
            iconColor="oklch(70% 0.15 70)"
            count={todayNotes.length}
            active={view === "today"}
            onClick={() => setView("today")}
          />
        </div>

        <div>
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-xs font-medium text-muted-foreground">Folders</p>
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              aria-label="New folder"
              className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {collections.map((c, i) => (
              <FolderRow
                key={c.id}
                label={c.name}
                icon={Folder}
                iconColor={hueSwatch(hueForIndex(i))}
                count={allNotes.filter((n) => n.collections.some((oc) => oc.slug === c.slug)).length}
                active={view === c.slug}
                onClick={() => setView(c.slug)}
                collection={c}
                onDeleted={() => view === c.slug && setView("all")}
                onDropNote={(noteId) => fileNoteIntoFolder(noteId, c)}
              />
            ))}
          </div>
          {creatingFolder && (
            <input
              autoFocus
              value={folderDraft}
              onChange={(e) => setFolderDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreateFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setFolderDraft("");
                }
              }}
              onBlur={submitCreateFolder}
              placeholder="Folder name"
              className="mt-0.5 w-full rounded-lg bg-foreground/8 px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
        </div>
      </aside>

      <div className="flex w-80 shrink-0 flex-col border-r border-border/60">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h1 className="font-heading text-lg font-semibold tracking-heading">Notes</h1>
          <div className="flex items-center gap-1.5">
            <Kbd>⌘⇧N</Kbd>
            <Button size="icon-sm" variant="outline" onClick={createNote} aria-label="New note">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-3">
          {/* The icon's positioned ancestor must be a snug wrapper around
              just the input — centering it against the outer div above
              (which also carries pb-3) skews `top-1/2` by that extra
              padding, since percentage centering is relative to the
              *containing block's* full height, not the input's. */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="h-8 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {visibleNotes.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notes here yet.
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  active={selectedId === note.id}
                  onSelect={() => setSelectedId(note.id)}
                  onDeleted={() => selectedId === note.id && setSelectedId(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <NoteDetailPane
            key={selected.id}
            note={selected}
            onDeleted={() => {
              setSelectedId(null);
              mutateNotes();
              refreshLibrary();
            }}
            onSaved={() => {
              mutateNotes();
              refreshLibrary();
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a note, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
  active,
  onSelect,
  onDeleted,
}: {
  note: ApiItem;
  active: boolean;
  onSelect: () => void;
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
        await remove(note);
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
            e.dataTransfer.setData("text/plain", note.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={onSelect}
          className={cn(
            "block w-full cursor-grab border-b border-border/40 px-4 py-2.5 text-left transition-colors active:cursor-grabbing",
            active ? "bg-foreground/8" : "hover:bg-foreground/4",
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium">
              {note.title || "New Note"}
            </p>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatNoteTimestamp(note.updatedAt)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {note.bodyText || "No additional text"}
          </p>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FolderRow({
  label,
  icon: Icon,
  iconColor,
  count,
  active,
  onClick,
  collection,
  onDeleted,
  onDropNote,
}: {
  label: string;
  icon: typeof Folder;
  /** An oklch()/color string — Things-style colorful icons instead of
   * flat gray ones. Undefined falls back to the muted-foreground
   * default (used for "All Notes", which isn't tied to any one folder's
   * color). */
  iconColor?: string;
  count: number;
  active: boolean;
  onClick: () => void;
  /** Only real Collections (not the "All Notes" pseudo-folder) can be
   * renamed or deleted — its absence turns off the context menu. */
  collection?: { id: string; name: string; slug: string };
  onDeleted?: () => void;
  onDropNote?: (noteId: string) => void;
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
        if (!onDropNote) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={() => onDropNote && setIsDropTarget(true)}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(e) => {
        if (!onDropNote) return;
        e.preventDefault();
        setIsDropTarget(false);
        const noteId = e.dataTransfer.getData("text/plain");
        if (noteId) onDropNote(noteId);
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

function NoteDetailPane({
  note,
  onDeleted,
  onSaved,
}: {
  note: ApiItem;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const { mutate: globalMutate } = useSWRConfig();
  const { remove } = useItemActions();
  const [title, setTitle] = useState(note.title ?? "");

  const saveTitle = useDebouncedCallback(async (value: string) => {
    await fetch(`/api/items/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    onSaved();
  }, 600);

  const saveNote = useDebouncedCallback(
    async (payload: { json: JSONContent; text: string }) => {
      await fetch(`/api/items/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyJson: payload.json, bodyText: payload.text }),
      });
      onSaved();
    },
    800,
  );

  async function saveTags(tags: string[]) {
    await fetch(`/api/items/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    onSaved();
  }

  async function saveCollections(names: string[]) {
    await fetch(`/api/items/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collections: names }),
    });
    void globalMutate("/api/collections");
    onSaved();
  }

  async function handleDelete() {
    await remove(note);
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-6 pb-2 pt-5">
        <p className="text-xs text-muted-foreground">
          Edited {formatNoteTimestamp(note.updatedAt)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" aria-label="Note options" />}
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
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            saveTitle(e.target.value);
          }}
          placeholder="Untitled"
          // The base Input component bakes in `h-8` and a responsive
          // `md:text-sm` — both need an explicit override here (not just
          // `text-2xl`), since tailwind-merge only drops a conflicting
          // base utility when the override targets the exact same
          // variant scope. Without `md:text-2xl` too, the base
          // `md:text-sm` silently wins on any desktop-width viewport.
          className="mb-3 h-auto border-none px-4 py-2 font-heading text-2xl leading-tight font-semibold tracking-heading shadow-none focus-visible:ring-0 md:text-2xl"
        />

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Folders</span>
            <TagEditor
              tags={note.collections.map((c) => c.name)}
              onChange={saveCollections}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Tags</span>
            <TagEditor tags={note.tags.map((t) => t.name)} onChange={saveTags} />
          </div>
        </div>

        <NoteEditor
          content={(note.bodyJson as JSONContent) ?? note.bodyText}
          onUpdate={saveNote}
        />
      </div>
    </div>
  );
}
