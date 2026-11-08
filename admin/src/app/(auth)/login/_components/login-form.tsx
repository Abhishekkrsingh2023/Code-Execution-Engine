"use client";

import * as React from "react";
import { useActionState } from "react";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock } from "lucide-react";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="username_or_email" required>
          Username or Email
        </Label>
        <Input
          id="username_or_email"
          name="username_or_email"
          type="text"
          autoComplete="username"
          required
          placeholder="admin@code0.dev"
          disabled={isPending}
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
          disabled={isPending}
        />
      </div>

      <Button
        type="submit"
        className="w-full mt-2"
        isLoading={isPending}
        disabled={isPending}
      >
        <Lock className="h-3.5 w-3.5 mr-2" />
        Sign In to Console
      </Button>
    </form>
  );
}

