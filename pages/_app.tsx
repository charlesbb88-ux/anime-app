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
        <div className="min-h-screen bg-[#f5f5f5] font-sans">
          {!hideHeader && <Header />}
          <Component {...pageProps} />
        </div>

        <AuthModalManager />
      </>
    </UsernameGate>
  );
}
