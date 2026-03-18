export type TitleBandKey = "low" | "mid" | "high";

export type TitleBand = {
  key: TitleBandKey;
  minLevel: number;
  maxLevel: number | null;
};

export const TITLE_LEVEL_BANDS: TitleBand[] = [
  { key: "low", minLevel: 1, maxLevel: 29 },
  { key: "mid", minLevel: 30, maxLevel: 59 },
  { key: "high", minLevel: 60, maxLevel: null },
];

export function getTitleBandFromLevel(level: number): TitleBandKey {
  for (const band of TITLE_LEVEL_BANDS) {
    const meetsMin = level >= band.minLevel;
    const meetsMax = band.maxLevel === null || level <= band.maxLevel;

    if (meetsMin && meetsMax) {
      return band.key;
    }
  }

  return "low";
}