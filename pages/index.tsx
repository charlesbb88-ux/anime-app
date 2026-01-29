"use client";

import React, { useEffect, useState } from "react";
import LeftSidebar from "../components/LeftSidebar";
import RightSidebar from "../components/RightSidebar";
import PostFeed from "../components/PostFeed";
import UsernameGate from "../components/UsernameGate";

const LAYOUT = {
  pageMaxWidth: "72rem",
  pagePaddingY: "2rem",
  pagePaddingX: "1rem",
  columnGap: "1rem",
  mainWidth: "36rem",
  sidebarWidth: "16rem",
};

// phone-only breakpoint (iPads/tablets keep sidebars)
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

export default function Home() {
  const isPhone = useIsPhone();

  return (
    <UsernameGate>
      <div
        style={{
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          // ✅ Prevent any accidental horizontal overflow on phones
          overflowX: isPhone ? "hidden" : undefined,
        }}
      >
        <div
          style={{
            maxWidth: LAYOUT.pageMaxWidth,
            margin: "0 auto",
            padding: isPhone
              ? `0 0` // ✅ no top or side padding on phones
              : `${LAYOUT.pagePaddingY} ${LAYOUT.pagePaddingX}`, // desktop unchanged
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: LAYOUT.columnGap,
              // ✅ Important: lets children shrink instead of forcing overflow
              minWidth: 0,
            }}
          >
            {!isPhone && (
              <aside
                style={{
                  flex: `0 0 ${LAYOUT.sidebarWidth}`,
                  maxWidth: LAYOUT.sidebarWidth,
                  position: "sticky",
                  top: "1.5rem",
                  alignSelf: "flex-start",
                  height: "fit-content",
                }}
              >
                <LeftSidebar />
              </aside>
            )}

            <main
              style={
                isPhone
                  ? {
                    // ✅ Phone: full width, no fixed rem width
                    flex: "1 1 auto",
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                  }
                  : {
                    // ✅ Desktop/tablet: EXACTLY your current layout
                    flex: `0 0 ${LAYOUT.mainWidth}`,
                    maxWidth: LAYOUT.mainWidth,
                  }
              }
            >
              <PostFeed />
            </main>

            {!isPhone && (
              <aside
                style={{
                  flex: `0 0 ${LAYOUT.sidebarWidth}`,
                  maxWidth: LAYOUT.sidebarWidth,
                  position: "sticky",
                  top: "1.5rem",
                  alignSelf: "flex-start",
                  height: "fit-content",
                }}
              >
                <RightSidebar />
              </aside>
            )}
          </div>
        </div>
      </div>
    </UsernameGate>
  );
}
