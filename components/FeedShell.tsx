"use client";

import { useEffect, useState } from "react";

const PHONE_MAX_WIDTH_PX = 767; // phones only

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
    const update = () => setIsPhone(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  return isPhone;
}

export default function FeedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const isPhone = useIsPhone();

  // 🚫 Phones: shell does not exist
  if (isPhone) {
    return <>{children}</>;
  }

  // ✅ Tablets + desktop: normal shell
  return (
    <div
      style={{
        border: "3px solid #000",
        background: "#fff",
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
}
