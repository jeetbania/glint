import { NextResponse } from "next/server";
import { createCard } from "@/lib/kanban";
import { createKanbanCardSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createKanbanCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const card = await createCard(parsed.data.columnId, parsed.data.title);
  return NextResponse.json({ card });
}
