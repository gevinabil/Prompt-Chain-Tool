import type { ReactNode } from "react";
import { Card } from "@/components/ui";

type AdminPageProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AdminPage({ eyebrow, title, description, children }: AdminPageProps) {
  return (
    <section className="surface-grid">
      <Card className="stack-tight" scanlines>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </Card>
      {children}
    </section>
  );
}

type AdminTableCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AdminTableCard({ eyebrow, title, description, children }: AdminTableCardProps) {
  return (
    <Card className="stack-tight">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </Card>
  );
}
