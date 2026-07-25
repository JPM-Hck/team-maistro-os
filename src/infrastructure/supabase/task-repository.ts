import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function reserveTaskMaterials(taskId: string, idempotencyKey: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_task_materials", {
    p_task_id: taskId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(`No fue posible reservar materiales: ${error.message}`);
  return data;
}
