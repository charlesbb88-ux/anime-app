"use client";

import React from "react";
import ProfileTabsRow from "@/components/profile/ProfileTabsRow";
import ProfileAboutSection from "@/components/profile/ProfileAboutSection";
import ProfilePostsFeed from "@/components/profile/ProfilePostsFeed";

const PHONE_SIDE_PX = 0; // change this: 0, 6, 8, 10, 12, 16
const PHONE_TOP_GAP_PX = 28; // ✅ space under the header (phone only)

type Props = {
    profileId: string;
    username: string;

    aboutHtml: string;

    viewerUserId: string | null;

    displayName: string;
    avatarInitial: string;
    canonicalHandle?: string;
    avatarUrl: string | null;

    pinnedPostId?: string | null;
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
    pinnedPostId, // ✅ add this line
}: Props) {
    return (
        <div
            style={{
                width: "100%",
                maxWidth: "100%",
                paddingLeft: PHONE_SIDE_PX,
                paddingRight: PHONE_SIDE_PX,

                // ✅ space between media header and everything below
                marginTop: PHONE_TOP_GAP_PX,
            }}
        >
            <ProfileTabsRow
                username={username}
                activeTab="posts"
                className="mb-0"
                variant="card"
                center
            />

            <ProfileAboutSection html={aboutHtml} />
            <div className="mb-0" />

            <section className="border-t border-black md:border-t-0">
                <ProfilePostsFeed
                    profileId={profileId}
                    viewerUserId={viewerUserId}
                    displayName={displayName}
                    avatarInitial={avatarInitial}
                    canonicalHandle={canonicalHandle}
                    avatarUrl={avatarUrl}
                    pinnedPostId={pinnedPostId ?? null} // ✅ add this line
                />
            </section>
        </div>
    );
}