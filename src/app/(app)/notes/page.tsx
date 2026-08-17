import { LibraryView } from "@/components/library-view";

export default function NotesPage() {
  return (
    <LibraryView
      fixedType="note"
      emptyMessage="No notes yet. Paste plain text anywhere (outside a URL) to create one, or add tasks from the Library."
    />
  );
}
