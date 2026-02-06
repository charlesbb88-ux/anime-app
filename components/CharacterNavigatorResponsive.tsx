"use client";

import React, { useEffect, useState } from "react";
import CharacterNavigator from "@/components/CharacterNavigator";
import CharacterNavigatorMobile from "@/components/CharacterNavigatorMobile";

type Props = {
  slug: string;
  className?: string;
  limit?: number;
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

export default function CharacterNavigatorResponsive(props: Props) {
  const isPhone = useIsPhone();

  if (isPhone) return <CharacterNavigatorMobile {...props} />;
  return <CharacterNavigator {...props} />;
}
