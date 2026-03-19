"use client";

const abilities = [
  "No abilities unlocked yet",
  "Ability slot locked",
  "Ability slot locked",
  "Passive slot locked",
];

export default function AbilitiesCard() {
  return (
    <div className="rounded-md border border-white/10 bg-black px-4 py-2">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">Abilities</div>

      <div className="mt-2 space-y-3">
        {abilities.map((ability, index) => (
          <div
            key={`${ability}-${index}`}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
          >
            <div className="text-sm font-medium">{ability}</div>
          </div>
        ))}
      </div>
    </div>
  );
}