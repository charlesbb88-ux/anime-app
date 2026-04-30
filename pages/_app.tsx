// pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import type { NextPage } from "next";
import React from "react";
import Head from "next/head";

import Header from "../components/Header";
import AuthModalManager from "../components/AuthModalManager";
import UsernameGate from "../components/UsernameGate";
import OnboardingTutorialModal from "../components/OnboardingTutorialModal";

import { Analytics } from "@vercel/analytics/react";

export type NextPageWithHeader = NextPage & {
  hideHeader?: boolean;
  headerTransparent?: boolean;
};

type AppPropsWithHeader = AppProps & {
  Component: NextPageWithHeader;
};

export default function App({ Component, pageProps }: AppPropsWithHeader) {
  const hideHeader = Component.hideHeader === true;
  const headerTransparent = Component.headerTransparent === true;

  return (
    <UsernameGate>
      <>
        <Head>
          <title>Inkbased</title>

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
            key="viewport"
          />

          <link rel="icon" href="/favicon.png" />
        </Head>

        <div className="min-h-screen font-sans">
          {!hideHeader && <Header transparent={headerTransparent} />}
          <Component {...pageProps} />
        </div>

        <AuthModalManager />
        <OnboardingTutorialModal />
        <Analytics />
      </>
    </UsernameGate>
  );
}