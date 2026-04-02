import AdminGate from "@/components/admin/AdminGate";

export default function AdminPage() {
  return (
    <AdminGate>
      <div className="p-10">
        <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
        <p>You are authorized.</p>
      </div>
    </AdminGate>
  );
}