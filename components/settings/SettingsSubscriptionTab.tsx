"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  isPro?: boolean | null;
};

type ProfileBillingRow = {
  is_pro: boolean | null;
  stripe_cancel_at_period_end: boolean | null;
  stripe_current_period_end: string | null;
  stripe_cancel_at: string | null;
};

export default function SettingsSubscriptionTab({ isPro }: Props) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingState, setBillingState] = useState<ProfileBillingRow>({
    is_pro: Boolean(isPro),
    stripe_cancel_at_period_end: false,
    stripe_current_period_end: null,
    stripe_cancel_at: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadBillingState() {
      try {
        setIsLoadingProfile(true);
        setError(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          if (isMounted) {
            setBillingState({
              is_pro: false,
              stripe_cancel_at_period_end: false,
              stripe_current_period_end: null,
              stripe_cancel_at: null,
            });
          }
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            "is_pro, stripe_cancel_at_period_end, stripe_current_period_end, stripe_cancel_at"
          )
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw new Error(profileError.message);
        }

        if (isMounted) {
          const profile = data as ProfileBillingRow | null;

          setBillingState({
            is_pro: Boolean(profile?.is_pro),
            stripe_cancel_at_period_end: Boolean(profile?.stripe_cancel_at_period_end),
            stripe_current_period_end: profile?.stripe_current_period_end ?? null,
            stripe_cancel_at: profile?.stripe_cancel_at ?? null,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";

        if (isMounted) {
          setError(message);
          setBillingState({
            is_pro: Boolean(isPro),
            stripe_cancel_at_period_end: false,
            stripe_current_period_end: null,
            stripe_cancel_at: null,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadBillingState();

    return () => {
      isMounted = false;
    };
  }, [isPro]);

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

  const isProActive = Boolean(billingState.is_pro);

  const cancellationDate = useMemo(() => {
    const rawDate =
      billingState.stripe_cancel_at || billingState.stripe_current_period_end;

    if (!rawDate) {
      return null;
    }

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [billingState.stripe_cancel_at, billingState.stripe_current_period_end]);

  const hasCancellationScheduled =
    Boolean(billingState.stripe_cancel_at_period_end) ||
    Boolean(billingState.stripe_cancel_at);

  return (
    <div className="max-w-xl space-y-4">
      {isProActive ? (
        <>
          <div className="bg-white rounded-xs border-2 border-black p-5 space-y-2">
            <div className="text-sm font-semibold text-blue-600">
              Pro Active
            </div>

            {hasCancellationScheduled ? (
              <>
                <p className="text-xs text-slate-700">
                  Your subscription has been canceled, but Pro is still active for now.
                </p>

                <div className="rounded-xs border border-amber-300 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-800">
                    Cancellation scheduled
                  </div>
                  <div className="mt-1 text-xs text-amber-700">
                    {cancellationDate
                      ? `You will keep Pro until ${cancellationDate}.`
                      : "You will keep Pro until the end of your current billing period."}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-600">
                You are currently subscribed to Pro.
              </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-xs border-2 border-black p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              Current plan
            </div>

            <div className="text-xs text-slate-600">
              Pro badge next to your username and no ads.
            </div>

            {hasCancellationScheduled && cancellationDate ? (
              <div className="text-xs text-slate-700">
                Access ends on <span className="font-semibold">{cancellationDate}</span>.
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleManageBilling}
              disabled={isLoadingPortal || isLoadingProfile}
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

            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}