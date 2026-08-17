import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { renameColumn, deleteColumn } from "@/lib/kanban";
import { renameKanbanColumnSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = renameKanbanColumnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const column = await renameColumn(id, parsed.data.name);
  if (!column) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ column });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteColumn(id);
  return NextResponse.json({ ok: true });
}
