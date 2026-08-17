"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Bold, Italic, List, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

/** Freeform notes and checklists, both backed by the same Tiptap JSON doc
 * stored in `items.body_json` — a checklist is just a note using the
 * TaskList/TaskItem extensions. */
export function NoteEditor({
  content,
  editable = true,
  onUpdate,
}: {
  content: JSONContent | string | undefined;
  editable?: boolean;
  onUpdate?: (payload: { json: JSONContent; text: string }) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: content ?? "",
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdate?.({ json: editor.getJSON(), text: editor.getText() });
    },
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[120px] text-sm focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {editable && (
        <div className="flex items-center gap-1 border-b pb-2">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold"
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic"
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Bullet list"
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            label="Checklist"
          >
            <ListChecks className="size-3.5" />
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}
