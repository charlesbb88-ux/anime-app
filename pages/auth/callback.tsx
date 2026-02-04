import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Supabase magic link / OAuth callback typically includes `code=...`
      const code =
        typeof router.query.code === "string" ? router.query.code : null;

      if (!code) return;

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      // Remove the code from the URL and go somewhere sensible
      if (!cancelled) {
        if (error) {
          // You can change this destination if you have a login page
          router.replace("/?auth=error");
        } else {
          router.replace("/");
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <div>Logging you in…</div>
    </div>
  );
}
