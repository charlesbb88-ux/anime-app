// lib/markdown/renderProfileAbout.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

function isHttpsUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractYouTubeId(input: string): string | null {
  try {
    const url = new URL(input);

    // youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return id || null;
    }

    // youtube.com/watch?v=VIDEO_ID
    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      // youtube.com/embed/VIDEO_ID
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === "embed");
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

function escapeAttr(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert AniList-ish tags into safe raw HTML blocks before markdown processing:
 * - Spoiler: ~! spoiler !~ (also accepts ~~! spoiler !~~) -> <details class="about-spoiler"><summary>Spoiler</summary>...</details>
 * - Center:  [center]...[/center] -> <div class="about-center">...</div>
 * - YouTube: [youtube](url) -> <iframe ...>
 * - WebM:    [webm](url)    -> <video ...><source ...></video>
 */
function preprocess(input: string): string {
  let s = input ?? "";

  // [center] ... [/center]
  s = s.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, (_m, inner) => {
    return `\n<div class="about-center">\n${inner}\n</div>\n`;
  });

  // AniList spoiler supports ~! ... !~  (and we also accept ~~! ... !~~)
  s = s.replace(/~{1,2}!\s*([\s\S]*?)\s*!~{1,2}/g, (_m, inner) => {
    return `\n<details class="about-spoiler"><summary>Spoiler</summary>\n\n${inner}\n\n</details>\n`;
  });

  // [youtube](...)
  s = s.replace(/\[youtube\]\((.*?)\)/gi, (_m, rawUrl) => {
    let url = String(rawUrl || "").trim();
    if (!url) return "";

    // allow "youtube.com/..." or "www.youtube.com/..." by auto-adding https
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    // if http, upgrade to https
    url = url.replace(/^http:\/\//i, "https://");

    const id = extractYouTubeId(url);
    if (!id) return `[youtube](${rawUrl})`;

    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;

    return `\n<div class="about-embed">\n<iframe class="about-youtube" src="${escapeAttr(
      src
    )}" title="YouTube video" frameBorder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>\n</div>\n`;
  });

  // [webm](...)
  s = s.replace(/\[webm\]\((.*?)\)/gi, (_m, rawUrl) => {
    let url = String(rawUrl || "").trim();
    if (!url) return "";

    // allow no protocol by adding https
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    // if http, upgrade to https
    url = url.replace(/^http:\/\//i, "https://");

    if (!isHttpsUrl(url)) return `[webm](${rawUrl})`;

    try {
      const u = new URL(url);

      // accept .webm even if there are query params
      if (!u.pathname.toLowerCase().endsWith(".webm")) return `[webm](${rawUrl})`;

      return `\n<div class="about-embed">\n<video class="about-video" controls playsInline preload="metadata">\n<source src="${escapeAttr(
        url
      )}" type="video/webm" />\n</video>\n</div>\n`;
    } catch {
      return `[webm](${rawUrl})`;
    }
  });

  return s;
}

export async function renderProfileAboutToHtml(markdown: string): Promise<string> {
  const pre = preprocess(markdown);

  // Extend sanitize schema to allow the specific tags/attrs we generate + lists.
  const schema: any = {
    ...defaultSchema,
    tagNames: Array.from(
      new Set([
        ...(defaultSchema.tagNames || []),
        "details",
        "summary",
        "iframe",
        "video",
        "source",
        "div",
        "span",
        "ol",
        "ul",
        "li",

        // ✅ allow markdown headings
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ])
    ),
    attributes: {
      ...(defaultSchema.attributes || {}),

      a: Array.from(new Set([...(defaultSchema.attributes?.a || []), "rel", "target"])),

      img: Array.from(new Set([...(defaultSchema.attributes?.img || []), "src", "alt", "title", "loading"])),

      div: Array.from(new Set([...(defaultSchema.attributes?.div || []), "className"])),
      span: Array.from(new Set([...(defaultSchema.attributes?.span || []), "className"])),

      details: Array.from(new Set([...(defaultSchema.attributes?.details || []), "className", "open"])),
      summary: Array.from(new Set([...(defaultSchema.attributes?.summary || []), "className"])),

      h1: Array.from(new Set([...(defaultSchema.attributes?.h1 || []), "className"])),
      h2: Array.from(new Set([...(defaultSchema.attributes?.h2 || []), "className"])),
      h3: Array.from(new Set([...(defaultSchema.attributes?.h3 || []), "className"])),
      h4: Array.from(new Set([...(defaultSchema.attributes?.h4 || []), "className"])),
      h5: Array.from(new Set([...(defaultSchema.attributes?.h5 || []), "className"])),
      h6: Array.from(new Set([...(defaultSchema.attributes?.h6 || []), "className"])),

      iframe: Array.from(
        new Set([
          ...(defaultSchema.attributes?.iframe || []),
          "src",
          "title",
          "loading",
          "allow",
          "allowFullScreen",
          "frameBorder",
          "className",
        ])
      ),

      video: Array.from(new Set([...(defaultSchema.attributes?.video || []), "controls", "playsInline", "preload", "className"])),

      source: Array.from(new Set([...(defaultSchema.attributes?.source || []), "src", "type"])),

      // ✅ allow lists through sanitize
      ol: Array.from(new Set([...(defaultSchema.attributes?.ol || []), "className"])),
      ul: Array.from(new Set([...(defaultSchema.attributes?.ul || []), "className"])),
      li: Array.from(new Set([...(defaultSchema.attributes?.li || []), "className"])),
    },
    protocols: {
      ...(defaultSchema.protocols || {}),
      src: ["https"],
      href: ["https", "http", "mailto"],
    },
  };

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(pre);

  // Force safe link behavior
  const html = String(file.value).replace(
    /<a /g,
    '<a target="_blank" rel="nofollow noopener noreferrer" '
  );

  return html;
}