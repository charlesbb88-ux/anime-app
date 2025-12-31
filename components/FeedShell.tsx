"use client";

export default function FeedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "8px solid #000",
        background: "#fff",
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
}
