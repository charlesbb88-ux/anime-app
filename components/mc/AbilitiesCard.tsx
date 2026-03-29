"use client";

const abilities = [
  "No abilities unlocked yet",
  "Ability slot locked",
  "Ability slot locked",
  "Passive slot locked",
];

// helper → detects placeholder text
function isPlaceholderAbility(text: string) {
  return (
    text === "No abilities unlocked yet" ||
    text === "Ability slot locked" ||
    text === "Passive slot locked"
  );
}

export default function AbilitiesCard() {
  const allPlaceholders = abilities.every(isPlaceholderAbility);

  return (
    <div className="rounded-md border border-white/10 bg-black px-4 py-2">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">
        Abilities
      </div>

      <div className="mt-2 space-y-3">
        {allPlaceholders ? (
          // 🔥 If everything is placeholder → show ONE clean message
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center">
            <div className="text-sm font-medium text-white/40 italic">
              Coming soon
            </div>
          </div>
        ) : (
          // ✅ Future-ready: only render real abilities
          abilities
            .filter((ability) => !isPlaceholderAbility(ability))
            .map((ability, index) => (
              <div
                key={`${ability}-${index}`}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2"
              >
                <div className="text-sm font-medium">{ability}</div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}