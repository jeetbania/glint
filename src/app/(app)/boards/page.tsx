import { ComingSoon } from "@/components/coming-soon";
import { PenTool } from "lucide-react";

export default function BoardsPage() {
  return (
    <ComingSoon
      icon={PenTool}
      title="Infinite canvas boards"
      description="FigJam-style boards for freely arranging your saved items are coming in v2. Everything you paste is already saved to your Library in the meantime."
    />
  );
}
