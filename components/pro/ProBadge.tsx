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
        "inline-flex items-center rounded-full border border-slate-800 bg-slate-800 px-2 text-[10px] font-semibold uppercase tracking-wide text-white",
        className,
      ].join(" ")}
      title="View Pro"
    >
      Pro
    </Link>
  );
}