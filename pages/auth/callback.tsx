import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

function parseHashParams(hash: string) {
  // hash is like "#access_token=...&refresh_token=...&type=magiclink"
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_in: params.get("expires_in"),
    token_type: params.get("token_type"),
    type: params.get("type"),
  };
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // 1) Handle PKCE flow: ?code=...
      const code =
        typeof router.query.code === "string" ? router.query.code : null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) {
          router.replace(error ? "/?auth=error" : "/");
        }
        return;
      }

      // 2) Handle implicit flow: #access_token=...
      if (typeof window !== "undefined" && window.location.hash) {
        const { access_token, refresh_token } = parseHashParams(
          window.location.hash
        );

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          // Remove hash from URL then redirect
          if (!cancelled) {
            window.history.replaceState({}, document.title, "/auth/callback");
            router.replace(error ? "/?auth=error" : "/");
          }
          return;
        }
      }

      // If we get here, no recognizable auth params yet.
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
