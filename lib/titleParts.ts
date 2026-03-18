import type { TitleBandKey } from "@/lib/titleLevelBands";

export type TitleRoleParts = {
  prefix: string;
  class: string;
  domain: string;
};

export type TagTitleParts = Record<TitleBandKey, TitleRoleParts>;

export type McTitlePartsRow = {
  tag_id: number;
  tag_name: string;
  normalized_tag_name: string;

  low_prefix: string | null;
  low_class: string | null;
  low_domain: string | null;

  mid_prefix: string | null;
  mid_class: string | null;
  mid_domain: string | null;

  high_prefix: string | null;
  high_class: string | null;
  high_domain: string | null;
};

export const TITLE_PARTS_FALLBACK: TagTitleParts = {
  low: {
    prefix: "Wandering",
    class: "Adept",
    domain: "the Outer Lands",
  },
  mid: {
    prefix: "Grand",
    class: "Warden",
    domain: "the Central Realm",
  },
  high: {
    prefix: "Mythic",
    class: "Lord",
    domain: "the Eternal Domain",
  },
};

function safeString(value: unknown, fallback: string): string {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : fallback;
}

export function rowToTagTitleParts(row: McTitlePartsRow | null | undefined): TagTitleParts {
  if (!row) return TITLE_PARTS_FALLBACK;

  return {
    low: {
      prefix: safeString(row.low_prefix, TITLE_PARTS_FALLBACK.low.prefix),
      class: safeString(row.low_class, TITLE_PARTS_FALLBACK.low.class),
      domain: safeString(row.low_domain, TITLE_PARTS_FALLBACK.low.domain),
    },
    mid: {
      prefix: safeString(row.mid_prefix, TITLE_PARTS_FALLBACK.mid.prefix),
      class: safeString(row.mid_class, TITLE_PARTS_FALLBACK.mid.class),
      domain: safeString(row.mid_domain, TITLE_PARTS_FALLBACK.mid.domain),
    },
    high: {
      prefix: safeString(row.high_prefix, TITLE_PARTS_FALLBACK.high.prefix),
      class: safeString(row.high_class, TITLE_PARTS_FALLBACK.high.class),
      domain: safeString(row.high_domain, TITLE_PARTS_FALLBACK.high.domain),
    },
  };
}