"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

type SubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
};

export function SubmitButton({
  idleLabel,
  pendingLabel,
  variant = "primary",
  disabled = false
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button aria-busy={pending} disabled={disabled || pending} type="submit" variant={variant}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
