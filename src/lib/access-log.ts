import "server-only";
export async function accessLog(context: any, action: string, consultationId?: string, metadata: Record<string, unknown> = {}) {
  const { error } = await context.admin.from("audit_logs").insert({ practice_id: context.staff.practice_id, consultation_id: consultationId, actor_id: context.staff.id, actor_role: context.staff.role, action, metadata });
  if (error) throw new Error("Audit evidence could not be stored");
}
