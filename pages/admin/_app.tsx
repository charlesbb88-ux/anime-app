import type { AppProps } from "next/app";
import AdminGate from "@/components/admin/AdminGate";

export default function AdminApp({ Component, pageProps }: AppProps) {
  return (
    <AdminGate>
      <Component {...pageProps} />
    </AdminGate>
  );
}