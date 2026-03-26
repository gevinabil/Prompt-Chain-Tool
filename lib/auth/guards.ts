import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AdminProfile = {
  id: string;
  email: string | null;
  is_superadmin: boolean | null;
  is_matrix_admin: boolean | null;
};

export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, is_superadmin, is_matrix_admin")
    .eq("id", user.id)
    .single();

  const adminProfile = (profile ?? null) as AdminProfile | null;
  const isAllowed = Boolean(adminProfile?.is_superadmin || adminProfile?.is_matrix_admin);

  if (error || !isAllowed) {
    redirect("/login?reason=not_admin");
  }

  return { supabase, user, profile: adminProfile };
}
