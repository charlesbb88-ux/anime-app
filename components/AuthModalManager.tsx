// components/AuthModalManager.tsx
"use client";

import { useEffect, useState } from "react";
import AuthModal from "./AuthModal";

type OpenAuthDetail = {
  mode?: "login" | "signup";
  next?: string;
};

type AuthModalManagerProps = {
  eventName?: string;
};

export default function AuthModalManager({
  eventName = "open-auth-modal",
}: AuthModalManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [next, setNext] = useState<string | undefined>(undefined);

  useEffect(() => {
    function handleOpen(e: Event) {
      const ce = e as CustomEvent<OpenAuthDetail>;
      const m = ce?.detail?.mode;
      const n = ce?.detail?.next;

      setMode(m === "signup" ? "signup" : "login");
      setNext(typeof n === "string" ? n : undefined);
      setIsOpen(true);
    }

    window.addEventListener(eventName, handleOpen);
    return () => window.removeEventListener(eventName, handleOpen);
  }, [eventName]);

  return (
    <AuthModal
      isOpen={isOpen}
      mode={mode}
      next={next}
      onClose={() => setIsOpen(false)}
    />
  );
}
