"use client";

import { useState } from "react";

export function RepresentativeMiniCard({
  name,
  role,
  label,
  photoUrl,
  officialUrl,
  tone = "teal",
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
    <article className={`representative-card representative-card-${tone}`}>
      <span className="representative-avatar" aria-hidden="true">
        {photoUrl && failedPhoto !== photoUrl ? (
          // External portraits preserve initials if the image cannot load.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            onError={() => setFailedPhoto(photoUrl)}
          />
        ) : (
          initials || "CL"
        )}
      </span>
      <div>
        <h3>{name}</h3>
        <p>{role}</p>
        {label ? <span>{label}</span> : null}
        {officialUrl ? (
          <p>
            <a
              href={officialUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Official record for ${name}`}
            >
              Official record
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}
