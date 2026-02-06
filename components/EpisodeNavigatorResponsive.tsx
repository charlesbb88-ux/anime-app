// components/EpisodeNavigatorResponsive.tsx
"use client";

import React, { useEffect, useState } from "react";
import EpisodeNavigator from "@/components/EpisodeNavigator";
import EpisodeNavigatorMobile from "@/components/EpisodeNavigatorMobile";

type Props = {
  slug: string;
  totalEpisodes?: number | null;
  currentEpisodeNumber?: number | null;
  className?: string;
};

const PHONE_MAX_WIDTH_PX = 767;

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

export default function EpisodeNavigatorResponsive(props: Props) {
  const isPhone = useIsPhone();

  if (isPhone) return <EpisodeNavigatorMobile {...props} />;
  return <EpisodeNavigator {...props} />;
}
