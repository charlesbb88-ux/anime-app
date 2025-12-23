// pages/_app.tsx
"use client";

import "@/styles/globals.css";
import type { AppProps } from "next/app";
import React from "react";

import Header from "../components/Header";
import AuthModalManager from "../components/AuthModalManager";
import UsernameGate from "../components/UsernameGate";

type NextPageWithLayout = AppProps["Component"] & {
  getLayout?: (page: React.ReactElement) => React.ReactNode;
  hideHeader?: boolean;
};

export default function App({ Component, pageProps }: AppProps) {
  const C = Component as NextPageWithLayout;
  const hideHeader = C.hideHeader === true;
  const getLayout = C.getLayout ?? ((page) => page);

  return (
    <UsernameGate>
      <>
        <div className="min-h-screen font-sans">
          {!hideHeader && <Header />}
          {getLayout(<C {...pageProps} />)}
        </div>
        <AuthModalManager />
      </>
    </UsernameGate>
  );
}
