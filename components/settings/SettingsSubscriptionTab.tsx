"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  isPro?: boolean | null;
};

export default function SettingsSubscriptionTab({ isPro }: Props) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManageBilling() {
    try {
      setIsLoadingPortal(true);
      setError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("You must be signed in.");
      }

      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal.");
      }

      if (!data.url) {
        throw new Error("Billing portal URL was missing.");
      }

      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setIsLoadingPortal(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {isPro ? (
        <>
          <div className="bg-white rounded-xs border-2 border-black p-5 space-y-1">
            <div className="text-sm font-semibold text-blue-600">
              Pro Active
            </div>
            <p className="text-xs text-slate-600">
              You are currently subscribed to Pro.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xs border-2 border-black p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              Current plan
            </div>
            <div className="text-xs text-slate-600">
              Pro badge next to your username and no ads.
            </div>

            <button
              type="button"
              onClick={handleManageBilling}
              disabled={isLoadingPortal}
              className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-sm bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoadingPortal ? "Opening..." : "Manage Billing"}
            </button>

            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white rounded-xs border-2 border-black p-5 space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              Free Plan
            </div>
            <p className="text-xs text-slate-600">
              You are currently on the free plan.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xs border-2 border-black p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Upgrade to Pro
            </div>
            <div className="text-xs text-slate-600">
              Get a PRO badge next to your username and no ads.
            </div>

            <Link
              href="/pro"
              className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-sm bg-blue-500 text-white hover:bg-blue-600"
            >
              View Pro
            </Link>
          </div>
        </>
      )}
    </div>
  );
}