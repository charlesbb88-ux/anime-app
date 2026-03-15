import type { AffinityRow } from "@/components/mc/AffinitiesCard";

type ArchetypeDefinition = {
  name: string;
};

const archetypeMap: Record<string, ArchetypeDefinition> = {
  "action|adventure": { name: "Stormblade" },
  "action|sports": { name: "Battle Athlete" },
  "comedy|slice of life": { name: "Wandering Trickster" },
  "fantasy|adventure": { name: "Mythic Explorer" },
  "fantasy|magic": { name: "Arcane Scholar" },
  "horror|survival": { name: "Abyss Walker" },
  "magic|mystery": { name: "Spell Investigator" },
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function generateArchetype(affinities: AffinityRow[]): string {
  if (!affinities.length) return "Unranked Wanderer";

  const topTags = affinities
    .slice(0, 3)
    .map((tag) => ({
      original: String(tag.tag_name ?? "").trim(),
      normalized: normalizeTag(String(tag.tag_name ?? "")),
      level: Number(tag.tag_level ?? 0),
    }))
    .filter((tag) => tag.original.length > 0);

  let bestMatch: { name: string; score: number } | null = null;

  for (let i = 0; i < topTags.length; i++) {
    for (let j = i + 1; j < topTags.length; j++) {
      const key = [topTags[i].normalized, topTags[j].normalized].sort().join("|");
      const match = archetypeMap[key];

      if (!match) continue;

      const score = topTags[i].level + topTags[j].level;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          name: match.name,
          score,
        };
      }
    }
  }

  if (bestMatch) return bestMatch.name;

  const top = topTags[0]?.original;
  if (!top) return "Unranked Wanderer";

  return `${top} Adept`;
}