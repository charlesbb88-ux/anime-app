import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Data =
  | {
      ok: true;
      profileCount: number | null;
      hasUrl: boolean;
      urlPreview: string | null;
    }
  | {
      ok: false;
      error: string;
      hasUrl: boolean;
      urlPreview: string | null;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasUrl = !!url;
  const urlPreview = url ? url : null;

  try {
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
        hasUrl,
        urlPreview,
      });
    }

    return res.status(200).json({
      ok: true,
      profileCount: typeof count === "number" ? count : null,
      hasUrl,
      urlPreview,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message ?? String(err),
      hasUrl,
      urlPreview,
    });
  }
}