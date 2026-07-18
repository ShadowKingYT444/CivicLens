import type { Metadata } from "next";
import { BillDetailView } from "../../../../../components/bill-detail-view";

type BillPageProps = {
  params: Promise<{
    congress: string;
    type: string;
    number: string;
  }>;
};

export async function generateMetadata({ params }: BillPageProps): Promise<Metadata> {
  const { congress, type, number } = await params;
  return {
    title: `${type.toUpperCase()} ${number} (${congress})`,
  };
}

export default async function BillPage({ params }: BillPageProps) {
  const { congress, type, number } = await params;

  return (
    <div className="page-shell">
      <BillDetailView congress={congress} type={type} number={number} />
    </div>
  );
}
