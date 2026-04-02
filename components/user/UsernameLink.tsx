import Link from "next/link";
import ProBadge from "@/components/pro/ProBadge";

type Props = {
  username: string;
  isPro?: boolean | null;
  className?: string;
};

export default function UsernameLink({
  username,
  isPro,
  className = "",
}: Props) {
  return (
    <Link
      href={`/${username}`}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      <span>{username}</span>
      <ProBadge isPro={isPro} />
    </Link>
  );
}