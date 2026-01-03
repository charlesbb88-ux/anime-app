// pages/[username]/completions.tsx
import type { NextPage } from "next";
import ProfileLayout from "../../components/profile/ProfileLayout";
import CompletionsPageShell from "../../components/completions/CompletionsPageShell";

const CompletionsPage: NextPage = () => {
  return (
    <ProfileLayout activeTab="completions">
      <CompletionsPageShell />
    </ProfileLayout>
  );
};

export default CompletionsPage;
