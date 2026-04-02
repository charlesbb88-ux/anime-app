"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: ReactNode;
};

export default function AdminGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

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

  return <>{children}</>;
}