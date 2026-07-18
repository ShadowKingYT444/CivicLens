import Image from "next/image";
import type { CSSProperties } from "react";

export function AssetIcon({
  asset,
  alt,
  size = 96,
  className = "",
  decorative = false,
  priority = false,
}: {
  asset?: string;
  alt?: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}) {
  const label = decorative ? "" : (alt ?? "CivicLens illustration");

  if (!asset) {
    return (
      <span
        className={`asset-fallback ${className}`}
        style={{ width: size, height: size }}
        aria-hidden={decorative}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
      >
        CL
      </span>
    );
  }

  const style = { "--asset-size": `${size}px` } as CSSProperties;

  return (
    <span className={`asset-icon ${className}`} style={style} aria-hidden={decorative || undefined}>
      <Image
        src={asset}
        alt={label}
        fill
        sizes={`${size}px`}
        className="asset-icon-image"
        priority={priority}
        unoptimized={asset.endsWith(".png")}
      />
    </span>
  );
}
