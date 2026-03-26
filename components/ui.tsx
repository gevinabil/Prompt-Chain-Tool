import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type CardProps = {
  children: ReactNode;
  className?: string;
  scanlines?: boolean;
};

export function Card({ children, className, scanlines = false }: CardProps) {
  return <section className={joinClasses("card chrome", scanlines && "fx-scanlines", className)}>{children}</section>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return <button className={joinClasses("btn", `btn-${variant}`, className)} type={type} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={joinClasses("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={joinClasses("textarea", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={joinClasses("select", className)} {...props}>
      {children}
    </select>
  );
}

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
};

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}
