// lib/slugify.ts
export function slugify(input: string): string {
  const s = (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // fallback if title is empty or becomes nothing
  return s.length ? s : "untitled";
}
