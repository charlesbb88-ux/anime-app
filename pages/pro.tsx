import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";

type ProfileRow = {
    is_pro: boolean | null;
};

export default function ProPage() {
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
    const [isLoadingPortal, setIsLoadingPortal] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isPro, setIsPro] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { success, canceled } = router.query;

    useEffect(() => {
        let isMounted = true;

        async function loadProfile() {
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
                        setIsPro(false);
                    }
                    return;
                }

                const { data, error: profileError } = await supabase
                    .from("profiles")
                    .select("is_pro")
                    .eq("id", user.id)
                    .single<ProfileRow>();

                if (profileError) {
                    throw new Error(profileError.message);
                }

                if (isMounted) {
                    setIsPro(Boolean(data?.is_pro));
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Something went wrong.";
                if (isMounted) {
                    setError(message);
                    setIsPro(false);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingProfile(false);
                }
            }
        }

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, []);

    async function getAccessToken(): Promise<string> {
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

        return accessToken;
    }

    async function handleSubscribe() {
        try {
            setIsLoadingCheckout(true);
            setError(null);

            const accessToken = await getAccessToken();

            const response = await fetch("/api/stripe/create-checkout-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const data = (await response.json()) as { url?: string; error?: string };

            if (!response.ok) {
                throw new Error(data.error || "Failed to create checkout session.");
            }

            if (!data.url) {
                throw new Error("Stripe checkout URL was missing.");
            }

            window.location.href = data.url;
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Something went wrong.";
            setError(message);
            setIsLoadingCheckout(false);
        }
    }

    async function handleManageBilling() {
        try {
            setIsLoadingPortal(true);
            setError(null);

            const accessToken = await getAccessToken();

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

    const isBusy = isLoadingCheckout || isLoadingPortal || isLoadingProfile;

    return (
        <main className="min-h-screen bg-[#0b1220] text-white">
            <div className="mx-auto max-w-6xl px-4 py-12">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Show your support for Inkbased by upgrading to Pro
                    </h1>

                    {success === "1" ? (
                        <div className="mt-4 rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
                            Subscription successful. You are now Pro.
                        </div>
                    ) : null}

                    {canceled === "1" ? (
                        <div className="mt-4 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-400">
                            Checkout canceled. No changes were made.
                        </div>
                    ) : null}

                    {error ? (
                        <p className="mt-4 text-sm text-red-400">{error}</p>
                    ) : null}
                </div>

                <div className="mt-12 grid gap-6 md:grid-cols-2">
                    <section className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900/70 shadow-sm">
                        <div className="border-b border-slate-700 px-6 py-6">
                            <div className="inline-flex rounded-md bg-slate-700 px-3 py-1 text-sm font-bold tracking-wide text-white">
                                FREE
                            </div>

                            <h2 className="mt-5 text-2xl font-semibold">Free</h2>
                        </div>

                        <div className="flex-1 px-6 py-6">
                            <ul className="space-y-3 text-md text-slate-200">
                                <li>Log anime and manga</li>
                                <li>Write reviews and ratings</li>
                                <li>Use your profile and activity feed</li>
                                <li>Take part in battles and level up</li>
                            </ul>
                        </div>

                        <div className="border-t border-slate-700 bg-slate-800/70 px-6 py-6">
                            <div className="text-4xl font-bold">$0</div>
                            <div className="mt-1 text-sm text-slate-300">Forever free</div>

                            <button
                                type="button"
                                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm font-semibold text-white"
                            >
                                Current base plan
                            </button>
                        </div>
                    </section>

                    <section className="flex h-full flex-col rounded-2xl border border-cyan-500/50 bg-slate-900/70 shadow-sm">
                        <div className="border-b border-slate-700 px-6 py-6">
                            <div className="inline-flex rounded-md bg-cyan-500 px-3 py-1 text-sm font-bold tracking-wide text-slate-950">
                                PRO
                            </div>

                            <h2 className="mt-5 text-2xl font-semibold">Pro</h2>
                        </div>

                        <div className="flex-1 px-6 py-6">
                            <ul className="space-y-3 text-md text-slate-200">
                                <li>PRO badge next to your username</li>
                                <li>No ads</li>
                                <li>Personalized MC Abilites (coming soon)</li>
                                <li>Personalized MC (coming soon)</li>
                                <li>Supports future development of the site</li>
                            </ul>
                        </div>

                        <div className="border-t border-slate-700 bg-slate-800/70 px-6 py-6">
                            <div className="text-4xl font-bold">$5</div>
                            <div className="mt-1 text-sm text-slate-300">Per month</div>

                            {isLoadingProfile ? (
                                <button
                                    type="button"
                                    disabled
                                    className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 opacity-70"
                                >
                                    Loading...
                                </button>
                            ) : isPro ? (
                                <button
                                    type="button"
                                    onClick={handleManageBilling}
                                    disabled={isBusy}
                                    className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isLoadingPortal ? "Opening..." : "Manage Billing"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSubscribe}
                                    disabled={isBusy}
                                    className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isLoadingCheckout ? "Redirecting..." : "Subscribe"}
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}