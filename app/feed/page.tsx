import type { Metadata } from "next";
import { FeedBrowser } from "../../components/feed-browser";

export const metadata: Metadata = {
  title: "Learn",
};

export default function FeedPage() {
  return (
    <div className="page-shell">
      <FeedBrowser />
    </div>
  );
}
