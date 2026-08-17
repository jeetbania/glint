"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="glass-panel w-full max-w-sm space-y-6 rounded-2xl p-8">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-heading">
            Glint
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the password to continue.
          </p>
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              autoComplete="current-password"
            />
          </div>
          {state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Checking…" : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
