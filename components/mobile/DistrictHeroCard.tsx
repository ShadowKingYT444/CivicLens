import { MapPin, ShieldCheck } from "lucide-react";

export function DistrictHeroCard({
  districtCode,
  location,
  sample = false,
}: {
  districtCode: string;
  location?: string;
  sample?: boolean;
}) {
  return (
    <section className="district-hero-card" aria-labelledby="district-heading">
      <div>
        <span className="district-kicker">
          {sample ? "Sample district" : "Your district"}
        </span>
        <h2 id="district-heading">{districtCode}</h2>
        <p>{sample ? "Sample House district" : "House district"}</p>
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
