import { NextResponse } from "next/server";
import { listBoard, createColumn } from "@/lib/kanban";
import { createKanbanColumnSchema } from "@/lib/validation";

export async function GET() {
  const board = await listBoard();
  return NextResponse.json(board);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createKanbanColumnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const column = await createColumn(parsed.data.name);
  return NextResponse.json({ column });
}
