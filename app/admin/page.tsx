import type { Metadata } from "next";
import { AdminConsole } from "../../components/admin-console";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <div className="page-shell">
      <AdminConsole />
    </div>
  );
}
