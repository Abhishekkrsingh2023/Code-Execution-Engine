import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Navbar } from "@/components/shared/navbar";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Code0 — Code Execution Platform",
  description: "A fast, secure, and isolated online code execution platform for developers.",
  icons: {
    icon: "/Code0.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased flex flex-col h-screen overflow-hidden selection:bg-[var(--brand)] selection:text-white bg-[var(--background)] text-[var(--foreground)]">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar user={user} />
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
