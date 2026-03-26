import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <Card className="hero" scanlines>
        <span className="eyebrow">Authentication</span>
        <div className="stack-tight">
          <h1>Prompt Chain Tool</h1>
          <p>Sign in with Google to manage humor flavors and test prompt-chain captions.</p>
        </div>
        <GoogleSignInButton />
      </Card>
    </main>
  );
}
