export function RepresentativeMiniCard({
  name,
  role,
  label,
  photoUrl,
  tone = "teal",
}: {
  name: string;
  role: string;
  label?: string;
  photoUrl?: string;
  tone?: "teal" | "blue" | "purple";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <article className={`representative-card representative-card-${tone}`}>
      <span className="representative-avatar" aria-hidden="true">
        {photoUrl ? <img src={photoUrl} alt="" loading="lazy" /> : initials || "CL"}
      </span>
      <div>
        <h3>{name}</h3>
        <p>{role}</p>
        {label ? <span>{label}</span> : null}
      </div>
    </article>
  );
}
