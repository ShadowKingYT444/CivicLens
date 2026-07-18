import type { Metadata } from "next";
import { AnalyzeClient } from "../../components/analyze-client";

export const metadata: Metadata = {
  title: "Analyze",
};

export default function AnalyzePage() {
  return (
    <div className="page-shell">
      <AnalyzeClient />
    </div>
  );
}
