import Link from "next/link";

type Props = {
  isPro?: boolean | null;
  className?: string;
};

export default function ProBadge({
  isPro,
  className = "",
}: Props) {
  if (!isPro) return null;

  return (
    <Link
      href="/pro"
      onClick={(e) => e.stopPropagation()}
      className={[
        "inline-flex items-center rounded-full border border-cyan-400/60 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300",
        className,
      ].join(" ")}
      title="View Pro"
    >
      PRO
    </Link>
  );
}