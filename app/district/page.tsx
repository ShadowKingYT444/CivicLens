import type { Metadata } from "next";
import { DistrictLookup } from "../../components/district-lookup";

export const metadata: Metadata = {
  title: "District",
};

export default function DistrictPage() {
  return (
    <div className="page-shell">
      <DistrictLookup />
    </div>
  );
}
