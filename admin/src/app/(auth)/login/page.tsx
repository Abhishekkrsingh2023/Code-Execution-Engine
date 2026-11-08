import { Metadata } from "next";
import { LoginForm } from "./_components/login-form";
import { Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign In — code0 Console",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 mb-3 shadow-xs">
            <Terminal className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-100">
            code0 Staff Console
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Restricted to platform administrators and content moderators.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 shadow-sm backdrop-blur-xs">
          <LoginForm />
        </div>

        <div className="mt-6 text-center text-[11px] text-zinc-600">
          Internal management system. All authentication events and actions are audit-logged.
        </div>
      </div>
    </div>
  );
}

