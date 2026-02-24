// supabase/functions/cleanup-post-media/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const attachments = body?.attachments;

    if (!attachments || !Array.isArray(attachments)) {
      return new Response("No attachments", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service key required for storage delete
    );

    for (const a of attachments) {
      if (!a?.meta?.storage_path) continue;

      await supabase.storage
        .from("post_media")
        .remove([a.meta.storage_path]);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});