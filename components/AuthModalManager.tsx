"use client";

import { useEffect, useState } from "react";
import AuthModal from "./AuthModal";

type AuthModalManagerProps = {
  eventName?: string;
};

export default function AuthModalManager({
  eventName = "open-auth-modal",
}: AuthModalManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
    }

    window.addEventListener(eventName, handleOpen);
    return () => window.removeEventListener(eventName, handleOpen);
  }, [eventName]);

  function handleClose() {
    setIsOpen(false);
  }

  return <AuthModal isOpen={isOpen} onClose={handleClose} />;
}
