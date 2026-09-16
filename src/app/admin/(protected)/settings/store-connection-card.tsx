"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Globe, Key, Loader2, RefreshCw } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { testGamefyStoreAction } from "@/app/admin/(protected)/products/actions";

export function StoreConnectionCard({
  storeUrl,
  hasApiKey,
}: {
  storeUrl: string;
  hasApiKey: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleTest() {
    setResult(null);
    startTransition(async () => {
      const res = await testGamefyStoreAction();
      setResult(res);
    });
  }

  return (
    <Card className="mt-8 max-w-xl border-indigo-500/20 bg-indigo-500/[0.03]">
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Gamefy Live Web Integration</h3>
          </div>
          <a
            href={`${storeUrl}/admin/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            Open store admin
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <p className="text-xs text-zinc-400">
          Enables automatic one-click publishing and price syncing directly from Automation-Games to your live Gamefy storefront.
        </p>

        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Store URL:</span>
            <span className="font-mono text-zinc-200">{storeUrl}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">API Secret Key:</span>
            <span className="flex items-center gap-1 font-mono text-emerald-400">
              <Key className="h-3 w-3" />
              {hasApiKey ? "Configured" : "Missing in .env.local"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Supported Endpoints:</span>
            <span className="text-zinc-400">/api/v1/products, /api/v1/discounts</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={pending || !hasApiKey}
            className={buttonClass("secondary", "sm")}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Test Connection
          </button>

          {result && (
            <span
              className={`flex items-center gap-1 text-xs ${
                result.ok ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {result.ok && <CheckCircle2 className="h-3.5 w-3.5" />}
              {result.message}
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
