// pages/[username]/completions.tsx
"use client";

import type { NextPage } from "next";

import ProfileLayout from "@/components/profile/ProfileLayout";
import CompletionsPageShell from "@/components/completions/CompletionsPageShell";

const CompletionsPage: NextPage = () => {
  return (
    <ProfileLayout activeTab="completions">
      {({ profile }) => <CompletionsPageShell userId={profile.id} />}
    </ProfileLayout>
  );
};

export default CompletionsPage;
