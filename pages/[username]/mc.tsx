"use client";

import type { NextPage } from "next";
import ProfileLayout from "@/components/profile/ProfileLayout";
import MCLayout from "@/components/mc/MCLayout";

const MCPage: NextPage = () => {
  return (
    <ProfileLayout activeTab="mc">
      {({ profile }) => <MCLayout userId={profile.id} />}
    </ProfileLayout>
  );
};

export default MCPage;