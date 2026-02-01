// components/ChapterNavigatorResponsive.tsx
"use client";

import React, { useEffect, useState } from "react";
import ChapterNavigator from "@/components/ChapterNavigator";
import ChapterNavigatorMobile from "@/components/ChapterNavigatorMobile";

type Props = {
  slug: string;
  totalChapters?: number | null;
  currentChapterNumber?: number | null;
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

export default function ChapterNavigatorResponsive(props: Props) {
  const isPhone = useIsPhone();

  if (isPhone) return <ChapterNavigatorMobile {...props} />;
  return <ChapterNavigator {...props} />;
}
