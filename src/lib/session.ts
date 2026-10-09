import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Usuário logado + família dele. Redireciona se faltar algum. Memoizado por requisição. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .eq("user_id", user.id)
    .order("joined_at")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/comecar");

  const households = membership.households as unknown as { name: string } | null;
  return {
    supabase,
    user,
    householdId: membership.household_id as string,
    householdName: households?.name ?? "Família",
    role: membership.role as "owner" | "member",
  };
});
