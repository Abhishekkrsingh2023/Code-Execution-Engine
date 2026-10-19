import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import Code0Loader from "@/components/Code0Loader";
import { APP_NAME } from "@/lib/config";

export const metadata = {
  title: APP_NAME,
  description: "Next-generation online code execution and competitive programming platform.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="dark scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="bg-[#07090e] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-indigo-600 selection:text-white">
        <AuthProvider>
          <AuthGuard>
            <Suspense fallback={<div className="h-16 border-b border-slate-800" />}>
              <Navbar />
            </Suspense>
            <main className="flex-1 flex flex-col">
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                    <Code0Loader fullscreen={false} />
                  </div>
                }
              >
                {children}
              </Suspense>
            </main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
