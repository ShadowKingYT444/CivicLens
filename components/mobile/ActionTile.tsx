import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AssetIcon } from "../AssetIcon";

export function ActionTile({
  href,
  title,
  body,
  asset,
  tone = "teal",
}: {
  href: string;
  title: string;
  body: string;
  asset?: string;
  tone?: "teal" | "blue" | "purple" | "yellow" | "white";
}) {
  return (
    <Link className={`action-tile action-tile-${tone}`} href={href}>
      <AssetIcon asset={asset} alt="" decorative size={74} />
      <span>
        <strong>{title}</strong>
        <small>{body}</small>
      </span>
      <span className="tile-arrow" aria-hidden="true">
        <ArrowRight size={22} />
      </span>
    </Link>
  );
}
