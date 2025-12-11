"use client";

import "@/styles/globals.css";
import type { AppProps } from "next/app";
import React from "react";
import Header from "../components/Header";
import AuthModalManager from "../components/AuthModalManager";
import UsernameGate from "../components/UsernameGate";

export default function App({ Component, pageProps }: AppProps) {
  const hideHeader = (Component as any).hideHeader === true;

  return (
    <UsernameGate>
      <>
        <div
          style={{
            minHeight: "100vh",
            background: "#f5f5f5",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {!hideHeader && <Header />}
          <Component {...pageProps} />
        </div>

        {/* This is always mounted and listens for "open-auth-modal" */}
        <AuthModalManager />
      </>
    </UsernameGate>
  );
}
