import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { formatDateBR } from "@/lib/dates";
import { PageHeader, Sheet } from "@/components/ui";
import { InviteBox, RenameForm } from "./family-forms";

export const metadata: Metadata = { title: "Família" };

export default async function FamilyPage() {
  const { supabase, householdId, householdName, user } = await getSession();
  const { data: members } = await supabase.rpc("household_members_list", { p_household: householdId });

  return (
    <>
      <PageHeader title="Família" back="/mais" />
      <div className="flex flex-col gap-4">
        <Sheet className="p-4">
          <RenameForm name={householdName} />
        </Sheet>

        <Sheet className="p-4">
          <h2 className="font-semibold">Membros</h2>
          <ul className="mt-3 divide-y divide-rule">
            {(members ?? []).map((m: { user_id: string; email: string; role: string; joined_at: string }) => (
              <li key={m.user_id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  {m.email}
                  {m.user_id === user.id && <span className="text-ink-faint"> (você)</span>}
                </span>
                <span className="text-ink-faint">
                  {m.role === "owner" ? "criou" : "entrou"} em {formatDateBR(m.joined_at)}
                </span>
              </li>
            ))}
          </ul>
        </Sheet>

        <Sheet className="p-4">
          <h2 className="font-semibold">Convidar</h2>
          <p className="mt-1 text-sm text-ink-soft">
            A outra pessoa cria a conta dela no app e, na tela “Falta um passo”, digita este código. Vale por 7 dias e uma única vez.
          </p>
          <InviteBox />
        </Sheet>
      </div>
    </>
  );
}
