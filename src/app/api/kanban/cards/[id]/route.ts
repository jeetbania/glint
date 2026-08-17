import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { moveCard } from "@/lib/kanban";
import { moveKanbanCardSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = moveKanbanCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await moveCard(id, parsed.data.columnId, parsed.data.beforeOrder, parsed.data.afterOrder);
  return NextResponse.json({ ok: true });
}
