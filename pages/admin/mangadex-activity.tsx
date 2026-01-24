import { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  mangadex_id: string;
  manga_id: string | null;
  action: string;
  mangadex_updated_at: string;
  created_at: string;
  changed_fields: any;
};

type Props = {
  rows: Row[];
};

export default function Page({ rows }: Props) {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">MangaDex Sync Activity</h1>

      {rows.length === 0 && (
        <div className="text-gray-500">No activity yet.</div>
      )}

      {rows.map(row => (
        <div key={row.id} className="border rounded p-4 space-y-2">
          <div className="font-semibold text-sm text-gray-600">
            MangaDex ID: {row.mangadex_id}
          </div>

          <div>
            <strong>Action:</strong>{" "}
            {row.action === "insert" ? "🆕 Imported new manga" : "♻️ Updated existing manga"}
          </div>

          <div>
            <strong>MangaDex updated:</strong>{" "}
            {new Date(row.mangadex_updated_at).toLocaleString()}
          </div>

          <div>
            <strong>Processed at:</strong>{" "}
            {new Date(row.created_at).toLocaleString()}
          </div>

          {row.changed_fields && Object.keys(row.changed_fields).length > 0 && (
            <details className="bg-gray-50 p-2 rounded">
              <summary className="cursor-pointer font-medium">
                View changed fields
              </summary>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(row.changed_fields, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // must be server-side only
  );

  const { data, error } = await supabase
    .from("mangadex_delta_log")
    .select("*")
    .order("mangadex_updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return { props: { rows: [] } };
  }

  return {
    props: {
      rows: data ?? [],
    },
  };
};
