import type { Metadata } from "next";
import { BillBrowser } from "../../components/bill-browser";

export const metadata: Metadata = {
  title: "Bills",
};

export default function BillsPage() {
  return (
    <div className="page-shell">
      <BillBrowser />
    </div>
  );
}
