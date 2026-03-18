import type { AffinityRow } from "@/components/mc/AffinitiesCard";
import { getTitleBandFromLevel } from "@/lib/titleLevelBands";
import {
  rowToTagTitleParts,
  type McTitlePartsRow,
} from "@/lib/titleParts";

export type GeneratedTitle = {
  fullTitle: string;
  shortTitle: string;
  prefixTag: string | null;
  classTag: string | null;
  domainTag: string | null;
  prefixBand: "low" | "mid" | "high" | null;
  classBand: "low" | "mid" | "high" | null;
  domainBand: "low" | "mid" | "high" | null;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = "") {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : fallback;
}

export function generateTitleFromAffinities(
  affinities: AffinityRow[],
  titlePartRows: McTitlePartsRow[]
): GeneratedTitle {
  const topTags = affinities
    .slice(0, 3)
    .map((tag) => ({
      tagId: safeNumber(tag.tag_id, 0),
      tagName: safeString(tag.tag_name),
      tagLevel: safeNumber(tag.tag_level, 1),
    }))
    .filter((tag) => tag.tagName.length > 0);

  if (topTags.length === 0) {
    return {
      fullTitle: "The Wandering Adept of the Outer Lands",
      shortTitle: "Wandering Adept",
      prefixTag: null,
      classTag: null,
      domainTag: null,
      prefixBand: null,
      classBand: null,
      domainBand: null,
    };
  }

  const rowMap = new Map<number, McTitlePartsRow>();
  for (const row of titlePartRows) {
    rowMap.set(Number(row.tag_id), row);
  }

  const classSource = topTags[0];
  const prefixSource = topTags[1] ?? topTags[0];
  const domainSource = topTags[2] ?? topTags[topTags.length - 1] ?? topTags[0];

  const classBand = getTitleBandFromLevel(classSource.tagLevel);
  const prefixBand = getTitleBandFromLevel(prefixSource.tagLevel);
  const domainBand = getTitleBandFromLevel(domainSource.tagLevel);

  const classParts = rowToTagTitleParts(rowMap.get(classSource.tagId))[classBand];
  const prefixParts = rowToTagTitleParts(rowMap.get(prefixSource.tagId))[prefixBand];
  const domainParts = rowToTagTitleParts(rowMap.get(domainSource.tagId))[domainBand];

  const prefix = safeString(prefixParts.prefix, "Wandering");
  const className = safeString(classParts.class, "Adept");
  const domain = safeString(domainParts.domain, "the Outer Lands");

  return {
    fullTitle: `The ${prefix} ${className} of ${domain}`,
    shortTitle: `${prefix} ${className}`,
    prefixTag: prefixSource.tagName,
    classTag: classSource.tagName,
    domainTag: domainSource.tagName,
    prefixBand,
    classBand,
    domainBand,
  };
}