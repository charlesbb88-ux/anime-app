"use client";

export default function FeedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "3px solid #000",
        background: "#fff",
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
}
