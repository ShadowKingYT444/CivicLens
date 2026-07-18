import { MapPin, ShieldCheck } from "lucide-react";

export function DistrictHeroCard({
  districtCode,
  location,
}: {
  districtCode: string;
  location?: string;
}) {
  return (
    <section className="district-hero-card" aria-labelledby="district-heading">
      <div>
        <span className="district-kicker">Your district</span>
        <h2 id="district-heading">{districtCode}</h2>
        <p>House district</p>
        {location ? <p>{location}</p> : null}
        <span className="privacy-note">
          <ShieldCheck aria-hidden="true" size={24} />
          We use this only for lookup.
        </span>
      </div>
      <span className="district-hero-symbol" aria-hidden="true">
        <MapPin size={76} strokeWidth={2.4} />
      </span>
    </section>
  );
}
