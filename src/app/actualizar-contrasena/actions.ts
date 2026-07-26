"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface PasswordState {
  message: string;
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });

export async function updatePassword(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Revisa la contraseña.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      message:
        "La invitación expiró o ya fue utilizada. Solicita una invitación nueva.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      message:
        "No se pudo guardar la contraseña. Intenta con una contraseña diferente.",
    };
  }

  redirect("/");
}
