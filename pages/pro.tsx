export default function ProPage() {
    return (
        <main className="min-h-screen bg-[#0b1220] text-white">
            <div className="mx-auto max-w-6xl px-4 py-12">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Show your support for Inkbased by upgrading to Pro</h1>
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

                            <button
                                type="button"
                                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950"
                            >
                                Coming soon
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}