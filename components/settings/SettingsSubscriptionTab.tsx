"use client";

import Link from "next/link";

type Props = {
  isPro?: boolean | null;
};

export default function SettingsSubscriptionTab({ isPro }: Props) {
  return (
    <div className="max-w-xl space-y-4 bg-white rounded-xs border-2 border-black p-5">
      {isPro ? (
        <>
          {/* Header */}
          <div className="space-y-1">
            <div className="text-sm font-semibold text-blue-600">
              Pro Active
            </div>
            <p className="text-xs text-slate-600">
              You are currently subscribed to Pro.
            </p>
          </div>

          {/* Plan box */}
          <div className="rounded-xs border-2 border-black bg-slate-50 p-4 space-y-1">
            <div className="text-xs font-semibold text-slate-900">
              Current plan
            </div>
            <div className="text-xs text-slate-600">
              Pro badge next to your username and no ads once ads are added.
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Header */}
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              Free Plan
            </div>
            <p className="text-xs text-slate-600">
              You are currently on the free plan.
            </p>
          </div>

          {/* Upgrade box */}
          <div className="rounded-xs border-2 border-black bg-slate-50 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Upgrade to Pro
            </div>
            <div className="text-xs text-slate-600">
              Get a PRO badge next to your username and remove ads once ads are added.
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