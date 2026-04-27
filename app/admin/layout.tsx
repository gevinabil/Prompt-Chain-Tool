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
        <Card className="stack-tight sidebar-hero" scanlines>
          <span className="eyebrow">Prompt Chain Tool</span>
          <h2>Humor Flavor Manager</h2>
          <p>Create, duplicate, and test flavors from one polished prompt-workbench.</p>
          <div className="sidebar-pills">
            <span className="sidebar-pill">{user.email}</span>
            <span className="sidebar-pill">
              access: {profile?.is_superadmin ? "superadmin" : null}
              {profile?.is_superadmin && profile?.is_matrix_admin ? " + " : null}
              {profile?.is_matrix_admin ? "matrix_admin" : null}
            </span>
          </div>
        </Card>

        <Card className="stack-tight sidebar-panel">
          <span className="eyebrow">Theme</span>
          <p className="inline-hint">Switch palettes without changing the simplified glossy layout.</p>
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
