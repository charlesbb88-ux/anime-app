import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import levenshtein from "fast-levenshtein";

const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabase_url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in environment variables.");
}

if (!supabase_service_role_key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.");
}

const supabase = createClient(supabase_url, supabase_service_role_key);

const anilist_url = "https://graphql.anilist.co";
const batch_size = 20;
const anilist_per_page = 10;
const delay_ms = 1500;
const retry_delay_ms = 10000;
const max_retries = 3;

function normalize_title(str) {
    return String(str || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’`"]/g, "")
        .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\s]/g, " ")
        .replace(/\b(the|a|an)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function clean_search_title(str) {
    return String(str || "")
        .replace(/\([^)]*\)/g, " ")
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\b(doujinshi|guidebook|artbook|fanbook|anthology|official comic)\b/gi, " ")
        .replace(/[/:._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function similarity(a, b) {
    const aa = normalize_title(a);
    const bb = normalize_title(b);

    if (!aa || !bb) return 0;
    if (aa === bb) return 1;

    const dist = levenshtein.get(aa, bb);
    return 1 - dist / Math.max(aa.length, bb.length);
}

function get_candidate_titles(media) {
    return [
        media?.title?.romaji,
        media?.title?.english,
        media?.title?.native,
    ].filter(Boolean);
}

function pick_best_candidate(local_titles, candidates) {
    const normalized_local_titles = local_titles
        .filter(Boolean)
        .map((title) => ({
            raw: title,
            norm: normalize_title(title),
        }))
        .filter((entry) => entry.norm);

    let best = null;
    let second_best = null;

    for (const media of candidates) {
        const candidate_titles = get_candidate_titles(media);

        let best_score_for_media = 0;
        let best_title_for_media = null;
        let exact = false;

        for (const local of normalized_local_titles) {
            for (const candidate_title of candidate_titles) {
                const candidate_norm = normalize_title(candidate_title);

                if (local.norm === candidate_norm) {
                    best_score_for_media = 1;
                    best_title_for_media = candidate_title;
                    exact = true;
                    break;
                }

                const score = similarity(local.raw, candidate_title);

                if (score > best_score_for_media) {
                    best_score_for_media = score;
                    best_title_for_media = candidate_title;
                }
            }

            if (exact) break;
        }

        const entry = {
            id: media.id,
            matched_title: best_title_for_media,
            score: best_score_for_media,
            exact,
        };

        if (!best || entry.score > best.score) {
            second_best = best;
            best = entry;
        } else if (!second_best || entry.score > second_best.score) {
            second_best = entry;
        }
    }

    return { best, second_best };
}

function decide_match(best, second_best) {
    if (!best) {
        return {
            match_status: "no_match",
            should_save: false,
        };
    }

    if (best.exact) {
        return {
            match_status: "matched",
            should_save: true,
        };
    }

    if (
        best.score >= 0.96 &&
        (!second_best || best.score - second_best.score >= 0.03)
    ) {
        return {
            match_status: "matched",
            should_save: true,
        };
    }

    if (best.score >= 0.9) {
        return {
            match_status: "needs_review",
            should_save: false,
        };
    }

    return {
        match_status: "no_match",
        should_save: false,
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function search_anilist(title, attempt = 1) {
    const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          title {
            romaji
            english
            native
          }
        }
      }
    }
  `;

    const response = await fetch(anilist_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            query,
            variables: {
                search: title,
                page: 1,
                perPage: anilist_per_page,
            },
        }),
    });

    if (response.status === 429) {
        if (attempt >= max_retries) {
            throw new Error("AniList HTTP 429: Too Many Requests");
        }

        console.log(`Rate limited on "${title}". Waiting ${retry_delay_ms / 1000}s...`);
        await sleep(retry_delay_ms);
        return search_anilist(title, attempt + 1);
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`AniList HTTP ${response.status}: ${text}`);
    }

    const json = await response.json();

    if (json.errors) {
        const has_429 = json.errors.some((e) => e?.status === 429);

        if (has_429) {
            if (attempt >= max_retries) {
                throw new Error("AniList HTTP 429: Too Many Requests");
            }

            console.log(`Rate limited on "${title}". Waiting ${retry_delay_ms / 1000}s...`);
            await sleep(retry_delay_ms);
            return search_anilist(title, attempt + 1);
        }

        throw new Error(`AniList GraphQL error: ${JSON.stringify(json.errors)}`);
    }

    return json?.data?.Page?.media || [];
}

async function search_anilist_best(local_titles) {
    const search_titles = [...new Set(
        local_titles
            .filter(Boolean)
            .flatMap((title) => {
                const cleaned = clean_search_title(title);
                return [title, cleaned];
            })
            .map((title) => title.trim())
            .filter(Boolean)
    )];

    let all_candidates = [];

    for (const title of search_titles.slice(0, 5)) {
        const candidates = await search_anilist(title);
        all_candidates.push(...candidates);
        await sleep(delay_ms);
    }

    const unique_candidates = [];
    const seen_ids = new Set();

    for (const candidate of all_candidates) {
        if (!seen_ids.has(candidate.id)) {
            seen_ids.add(candidate.id);
            unique_candidates.push(candidate);
        }
    }

    return pick_best_candidate(local_titles, unique_candidates);
}

async function upsert_match_row(manga_id, payload) {
    const row = {
        manga_id,
        ...payload,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from("manga_anilist_matches")
        .upsert(row, { onConflict: "manga_id" });

    if (error) {
        throw error;
    }
}

async function update_manga_anilist_id(manga_id, anilist_id) {
    const { error } = await supabase
        .from("manga")
        .update({ anilist_id })
        .eq("id", manga_id);

    if (error) {
        throw error;
    }
}

async function fetch_batch(last_id = null) {
    let query = supabase
        .from("manga")
        .select(`
      id,
      title,
      title_english,
      title_native,
      title_preferred,
      manga_anilist_matches!left(manga_id)
    `)
        .is("anilist_id", null)
        .not("title", "is", null)
        .is("manga_anilist_matches.manga_id", null)
        .order("id", { ascending: true })
        .limit(batch_size);

    if (last_id) {
        query = query.gt("id", last_id);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        title_english: row.title_english,
        title_native: row.title_native,
        title_preferred: row.title_preferred,
    }));
}

async function main() {
    let last_id = null;
    let processed = 0;
    let matched = 0;
    let review = 0;
    let no_match = 0;
    let errors = 0;

    while (true) {
        const rows = await fetch_batch(last_id);

        if (!rows.length) {
            break;
        }

        for (const row of rows) {
            processed++;
            last_id = row.id;

            const local_titles = [
                row.title,
                row.title_english,
                row.title_native,
                row.title_preferred,
            ].filter(Boolean);

            try {
                const { best, second_best } = await search_anilist_best(local_titles);
                const decision = decide_match(best, second_best);

                if (!best) {
                    await upsert_match_row(row.id, {
                        matched_title: null,
                        match_score: 0,
                        match_status: "no_match",
                    });

                    no_match++;
                    console.log(`[NO MATCH] ${row.title}`);
                    continue;
                }

                const score_percent = Number((best.score * 100).toFixed(2));

                await upsert_match_row(row.id, {
                    matched_title: best.matched_title,
                    match_score: score_percent,
                    match_status: decision.match_status,
                });

                if (decision.should_save) {
                    await update_manga_anilist_id(row.id, best.id);
                    matched++;
                    console.log(
                        `[MATCHED] ${row.title} -> ${best.matched_title} (${best.id}) ${score_percent}%`
                    );
                } else if (decision.match_status === "needs_review") {
                    review++;
                    console.log(
                        `[REVIEW] ${row.title} -> ${best.matched_title} ${score_percent}%`
                    );
                } else {
                    no_match++;
                    console.log(
                        `[NO MATCH] ${row.title} -> ${best.matched_title} ${score_percent}%`
                    );
                }
            } catch (err) {
                errors++;

                try {
                    await upsert_match_row(row.id, {
                        matched_title: null,
                        match_score: null,
                        match_status: "error",
                    });
                } catch (inner_err) {
                    console.error(
                        `Failed writing error row for ${row.title}:`,
                        inner_err instanceof Error ? inner_err.message : inner_err
                    );
                }

                console.error(
                    `[ERROR] ${row.title}:`,
                    err instanceof Error ? err.message : err
                );
            }
        }
    }

    console.log("");
    console.log("DONE");
    console.log({
        processed,
        matched,
        review,
        no_match,
        errors,
    });
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});