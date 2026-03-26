import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Chain Tool",
  description: "Protected prompt-chain editor for humor flavors and caption testing."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="fx-grid">
          <div className="app-shell">{children}</div>
        </div>
      </body>
    </html>
  );
}
