"use client";

import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

function resolveTheme(preference: ThemePreference) {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return preference;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("prompt-chain-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = theme;
    localStorage.setItem("prompt-chain-theme", theme);

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = resolveTheme("system");
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div className="theme-toggle" role="tablist" aria-label="Theme">
      {(["light", "dark", "system"] as ThemePreference[]).map((option) => (
        <button
          className={option === theme ? "theme-chip is-active" : "theme-chip"}
          key={option}
          onClick={() => setTheme(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
