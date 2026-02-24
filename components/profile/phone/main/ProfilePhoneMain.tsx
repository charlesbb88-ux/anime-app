"use client";

import React from "react";
import ProfileTabsRow from "@/components/profile/ProfileTabsRow";
import ProfileAboutSection from "@/components/profile/ProfileAboutSection";
import ProfilePostsFeed from "@/components/profile/ProfilePostsFeed";

type Props = {
  profileId: string;
  username: string;

  aboutHtml: string;

  viewerUserId: string | null;

  displayName: string;
  avatarInitial: string;
  canonicalHandle?: string;
  avatarUrl: string | null;
};

export default function ProfilePhoneMain({
  profileId,
  username,
  aboutHtml,
  viewerUserId,
  displayName,
  avatarInitial,
  canonicalHandle,
  avatarUrl,
}: Props) {
  // This component’s only job: phone layout decisions.
  // PC layout stays exactly as-is in the page file.
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: "0 12px", // tweak phone padding here, without touching PC
      }}
    >
      <ProfileTabsRow
        username={username}
        activeTab="posts"
        className="mb-4"
        variant="card"
        center
      />

      <ProfileAboutSection html={aboutHtml} />
      <div className="mb-4" />

      <section>
        <ProfilePostsFeed
          profileId={profileId}
          viewerUserId={viewerUserId}
          displayName={displayName}
          avatarInitial={avatarInitial}
          canonicalHandle={canonicalHandle}
          avatarUrl={avatarUrl}
        />
      </section>
    </div>
  );
}