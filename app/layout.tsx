import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mise-en-Lens",
  description:
    "A film-literacy tutor that turns a Letterboxd Top 4 into personalized analysis, artistic context, and quiz-based learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
