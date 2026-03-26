"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignIn() {
    try {
      setLoading(true);
      setError(null);
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true }
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data?.url) {
        setError("Google OAuth URL was not returned by Supabase.");
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      setLoading(false);
      setError(error instanceof Error ? error.message : "Unexpected login error.");
    }
  }

  return (
    <div className="stack-tight">
      <Button onClick={onSignIn} disabled={loading}>
        {loading ? "Redirecting..." : "Continue with Google"}
      </Button>
      {error ? <p>Login error: {error}</p> : null}
    </div>
  );
}
