"use client";

import LeftSidebar from "../components/LeftSidebar";
import RightSidebar from "../components/RightSidebar";
import PostFeed from "../components/PostFeed";
import UsernameGate from "../components/UsernameGate";

const LAYOUT = {
  pageMaxWidth: "80rem",
  pagePaddingY: "2rem",
  pagePaddingX: "1.5rem",
  columnGap: "1rem",
  mainWidth: "41rem",
  sidebarWidth: "19rem",
};

export default function Home() {
  return (
    <UsernameGate>
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: LAYOUT.pageMaxWidth,
            margin: "0 auto",
            padding: `${LAYOUT.pagePaddingY} ${LAYOUT.pagePaddingX}`,
          }}
        >
          {/* ONE FLEX ROW: left | center | right */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: LAYOUT.columnGap,
            }}
          >
            {/* LEFT SIDEBAR */}
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

            {/* CENTER – main feed */}
            <main
              style={{
                flex: `0 0 ${LAYOUT.mainWidth}`,
                maxWidth: LAYOUT.mainWidth,
              }}
            >
              <PostFeed />
            </main>

            {/* RIGHT SIDEBAR */}
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
          </div>
        </div>
      </div>
    </UsernameGate>
  );
}
