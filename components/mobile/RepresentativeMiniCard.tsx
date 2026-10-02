"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

export function RepresentativeMiniCard({
  name,
  role,
  label,
  photoUrl,
  officialUrl,
}: {
  name: string;
  role: string;
  label?: string;
  photoUrl?: string;
  officialUrl?: string;
  tone?: "teal" | "blue" | "purple";
}) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <article className="editorial-representative">
      <span className="editorial-avatar" aria-hidden="true">
        {photoUrl && failedPhoto !== photoUrl ? (
          // Congress returns external portrait URLs; a failed request must preserve the initials fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            onError={() => setFailedPhoto(photoUrl)}
          />
        ) : (
          initials || "CL"
        )}
      </span>
      <div className="editorial-representative-copy">
        <h3>{name}</h3>
        <p>{role}</p>
        {label ? <p className="subtle">{label}</p> : null}
        {officialUrl ? (
          <a
            className="editorial-row-link"
            href={officialUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Official record for ${name}`}
          >
            Official record <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
