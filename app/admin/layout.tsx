import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

async function signOut() {
  "use server";
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireAdmin();

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Card className="stack-tight" scanlines>
          <span className="eyebrow">Prompt Chain Tool</span>
          <h2>Humor Flavor Manager</h2>
          <p>Create humor flavors, edit ordered steps, read captions, and test image sets with the REST API.</p>
          <small>{user.email}</small>
          <small>
            access: {profile?.is_superadmin ? "superadmin" : null}
            {profile?.is_superadmin && profile?.is_matrix_admin ? " + " : null}
            {profile?.is_matrix_admin ? "matrix_admin" : null}
          </small>
        </Card>

        <Card className="stack-tight">
          <span className="eyebrow">Theme</span>
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </Card>
      </aside>

      <div className="admin-content">{children}</div>
    </main>
  );
}
