// lib/markdown/renderProfileAbout.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

// AniList-like: markdown only, no raw HTML allowed.
// We sanitize the resulting HTML with a strict allowlist.
export async function renderProfileAboutToHtml(markdown: string): Promise<string> {
  const input = (markdown ?? "").toString();

  // Keep schema tight but allow the stuff users expect:
  // headings, lists, links, images, blockquotes, hr, code, tables (GFM).
  const schema = {
    ...defaultSchema,
    tagNames: Array.from(
      new Set([
        ...(defaultSchema.tagNames ?? []),
        "h1",
        "h2",
        "h3",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "pre",
        "code",
      ])
    ),
    attributes: {
      ...defaultSchema.attributes,
      a: Array.from(new Set([...(defaultSchema.attributes?.a ?? []), "href", "title", "target", "rel"])),
      img: Array.from(new Set([...(defaultSchema.attributes?.img ?? []), "src", "alt", "title"])),
      th: Array.from(new Set([...(defaultSchema.attributes?.th ?? []), "align"])),
      td: Array.from(new Set([...(defaultSchema.attributes?.td ?? []), "align"])),
      code: Array.from(new Set([...(defaultSchema.attributes?.code ?? []), "className"])),
      pre: Array.from(new Set([...(defaultSchema.attributes?.pre ?? []), "className"])),
    },
    protocols: {
      ...defaultSchema.protocols,
      href: ["http", "https", "mailto"],
      src: ["http", "https"],
    },
  };

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    // IMPORTANT: disallow raw HTML in markdown
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(input);

  // Post-process: force safe link behavior
  // (Sanitize blocks javascript: already via protocols, this is about rel/target defaults)
  const html = String(file)
    .replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer nofollow" ')
    // avoid duplicated rel/target weirdness
    .replace(/rel="noopener noreferrer nofollow"\s+rel="[^"]*"/gi, 'rel="noopener noreferrer nofollow"')
    .replace(/target="_blank"\s+target="[^"]*"/gi, 'target="_blank"');

  return html;
}
