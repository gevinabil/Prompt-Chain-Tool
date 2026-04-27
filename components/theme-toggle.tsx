"use client";

import { useEffect, useRef, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

function resolveTheme(preference: ThemePreference) {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return preference;
}

export function ThemeToggle() {
  const clearTimerRef = useRef<number | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("prompt-chain-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [pendingTheme, setPendingTheme] = useState<ThemePreference | null>(null);

  function applyTheme(nextTheme: ThemePreference) {
    const resolved = resolveTheme(nextTheme);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = nextTheme;
    localStorage.setItem("prompt-chain-theme", nextTheme);
  }

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = resolveTheme("system");
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  function handleThemeChange(nextTheme: ThemePreference) {
    setPendingTheme(nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);

    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }

    clearTimerRef.current = window.setTimeout(() => {
      setPendingTheme((current) => (current === nextTheme ? null : current));
      clearTimerRef.current = null;
    }, 260);
  }

  return (
    <div className="theme-toggle" role="tablist" aria-label="Theme">
      {(["light", "dark", "system"] as ThemePreference[]).map((option) => (
        <button
          aria-busy={pendingTheme === option}
          className={option === theme ? "theme-chip is-active" : "theme-chip"}
          key={option}
          onClick={() => handleThemeChange(option)}
          type="button"
        >
          {pendingTheme === option ? <span aria-hidden="true" className="btn-spinner theme-spinner" /> : null}
          {option}
        </button>
      ))}
    </div>
  );
}
