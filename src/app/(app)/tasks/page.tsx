import { ComingSoon } from "@/components/coming-soon";
import { KanbanSquare } from "lucide-react";

export default function TasksPage() {
  return (
    <ComingSoon
      icon={KanbanSquare}
      title="Kanban tasks"
      description="A drag-and-drop To-do / Doing / Done board is coming in v3, once Notes are polished. Task items will live alongside everything else in your Library."
    />
  );
}
