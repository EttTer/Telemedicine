import { getStaffContext } from "@/lib/staff";
import {
  consultationInput,
  hashSecret,
  json,
  newSecret,
  rpcError,
  sameOrigin,
} from "@/lib/workflow";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Nepovolený původ požadavku." }, 403);
  try {
    const context = await getStaffContext();
    if (!context.staff)
      return json({ error: "Přístup není povolen." }, context.status);
    const parsed = consultationInput.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return json(
        {
          error:
            "Zkontrolujte údaje a zvolte datum a čas od nynějška do jednoho roku.",
        },
        400,
      );
    const token = newSecret();
    const { data, error } = await context.admin.rpc("tm_staff_action", {
      p_staff: context.staff.id,
      p_id: null,
      p_action: "create",
      p_data: { ...parsed.data, token_hash: hashSecret(token) },
    });
    if (error) return rpcError(error);
    return json({ ...data, token });
  } catch {
    return json({ error: "Konzultaci se nepodařilo vytvořit." }, 500);
  }
}
