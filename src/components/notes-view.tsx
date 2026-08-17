"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Folder, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "@/components/note-editor";
import { TagEditor } from "@/components/tag-editor";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { groupByDate, formatNoteTimestamp } from "@/lib/date-groups";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";
import type { JSONContent } from "@tiptap/react";

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

  const [folderSlug, setFolderSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const collections = collectionsData?.collections ?? [];

  const allNotes = useMemo(() => notesData?.items ?? [], [notesData]);

  const folderNotes = useMemo(() => {
    if (!folderSlug) return allNotes;
    return allNotes.filter((n) => n.collections.some((c) => c.slug === folderSlug));
  }, [allNotes, folderSlug]);

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

  const refreshLibrary = () =>
    globalMutate((key) => typeof key === "string" && key.startsWith("/api/items"));

  async function createNote() {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", title: "" }),
    });
    const { item } = (await res.json()) as { item: ApiItem };
    if (folderSlug) {
      const folder = collections.find((c) => c.slug === folderSlug);
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
      <aside className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/60 px-3 py-4">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Folders</p>
        <FolderRow
          label="All Notes"
          icon={StickyNote}
          count={allNotes.length}
          active={folderSlug === null}
          onClick={() => setFolderSlug(null)}
        />
        {collections.map((c) => (
          <FolderRow
            key={c.id}
            label={c.name}
            icon={Folder}
            count={allNotes.filter((n) => n.collections.some((oc) => oc.slug === c.slug)).length}
            active={folderSlug === c.slug}
            onClick={() => setFolderSlug(c.slug)}
          />
        ))}
      </aside>

      <div className="flex w-80 shrink-0 flex-col border-r border-border/60">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h1 className="font-heading text-lg font-semibold tracking-heading">Notes</h1>
          <div className="flex items-center gap-1.5">
            <kbd className="text-[10px] text-muted-foreground">⌘⇧N</kbd>
            <Button size="icon-sm" variant="outline" onClick={createNote} aria-label="New note">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="relative shrink-0 px-4 pb-3">
          <Search className="absolute left-6.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="h-8 pl-8 text-sm"
          />
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
                <button
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={cn(
                    "block w-full border-b border-border/40 px-4 py-2.5 text-left transition-colors",
                    selectedId === note.id ? "bg-foreground/8" : "hover:bg-foreground/4",
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

function FolderRow({
  label,
  icon: Icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Folder;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-foreground/8 font-medium" : "text-muted-foreground hover:bg-foreground/4 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
    </button>
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
    await fetch(`/api/items/${note.id}`, { method: "DELETE" });
    toast.success("Deleted");
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-6 pb-2 pt-5">
        <p className="text-xs text-muted-foreground">
          Edited {formatNoteTimestamp(note.updatedAt)}
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
          aria-label="Delete note"
        >
          <Trash2 className="size-4" />
        </Button>
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
          className="mb-3 h-auto border-none px-0 py-1.5 font-heading text-2xl leading-tight font-semibold tracking-heading shadow-none focus-visible:ring-0 md:text-2xl"
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
