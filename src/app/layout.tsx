import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Protocol — AI Escape Room",
  description:
    "An immersive AI-powered escape room. Uncover the truth, solve puzzles, and decide the fate of an artificial consciousness.",
  keywords: ["escape room", "AI", "game", "puzzle", "interactive fiction"],
  openGraph: {
    title: "Nexus Protocol",
    description: "AI-powered immersive escape room experience",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
