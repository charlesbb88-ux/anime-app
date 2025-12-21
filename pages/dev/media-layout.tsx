// pages/dev/media-layout.tsx

import MediaLayout from "@/components/layouts/MediaLayout";

export default function MediaLayoutDev() {
  return (
    <MediaLayout
      title="Test Series Title"
      subtitle="Episode 7"
      metaLine="2023 • TV • Fantasy"
      posterUrl="https://placehold.co/300x450"
      backdropUrl="https://placehold.co/1600x900"
    >
      <div className="space-y-4">
        <div className="h-40 rounded bg-zinc-200" />
        <div className="h-40 rounded bg-zinc-200" />
        <div className="h-40 rounded bg-zinc-200" />
      </div>
    </MediaLayout>
  );
}
