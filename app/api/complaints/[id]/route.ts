import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const patchComplaintSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]).optional(),
  adminNote: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { status, adminNote } = parsed.data;

  if (!status && adminNote === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.complaint.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(adminNote !== undefined ? { adminNote } : {}),
    },
    include: { order: { select: { orderNumber: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    adminNote: updated.adminNote,
    orderNumber: updated.order?.orderNumber ?? null,
    updatedAt: updated.updatedAt,
  });
}
