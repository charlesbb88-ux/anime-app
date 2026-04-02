import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();

      const user = data?.user;

      // 🔒 CHANGE THIS TO YOUR EMAIL
      if (user?.email === "charlesbb88@gmail.com") {
        setIsAdmin(true);
      }

      setLoading(false);
    }

    check();
  }, []);

  if (loading) {
    return <div className="p-10">Loading...</div>;
  }

  if (!isAdmin) {
    return <div className="p-10">Unauthorized</div>;
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <p>You are authorized.</p>
    </div>
  );
}