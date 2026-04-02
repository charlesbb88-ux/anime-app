export default function ProPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-black">
      <h1 className="text-3xl font-bold">Pro</h1>
      <p className="mt-3 text-base text-slate-700">
        Support the site and get a Pro badge. More perks can come later.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Pro</h2>
            <p className="mt-1 text-sm text-slate-600">
              Badge next to your username and no ads once ads are added.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">$5</div>
            <div className="text-sm text-slate-500">per month</div>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-slate-700">
          <li>Pro badge next to your username</li>
          <li>No ads</li>
          <li>Supports the site</li>
        </ul>

        <button
          type="button"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Coming soon
        </button>
      </div>
    </main>
  );
}