"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { inputClass } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

// One shared password, not a Supabase account — see src/lib/auth/admin-session.ts.
export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Wrong password.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-base font-bold text-white">
          G
        </span>
        <span className="text-lg font-semibold tracking-tight text-zinc-50">Gamefy</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardBody>
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            <h1 className="text-sm font-semibold text-zinc-100">Admin access</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={submitting}
              className={buttonClass("primary", "md", "w-full")}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter"}
            </button>
          </form>
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
