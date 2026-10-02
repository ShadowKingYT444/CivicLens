export function DistrictHeroCard({
  districtCode,
  location,
  demo = false,
}: {
  districtCode: string;
  location?: string;
  demo?: boolean;
}) {
  return (
    <section
      className="editorial-district-summary"
      aria-labelledby="district-heading"
    >
      <p className="editorial-kicker">
        {demo ? "Sample House district" : "Your House district"}
      </p>
      <h2 id="district-heading">{districtCode}</h2>
      {location ? (
        <p className="subtle">{location} · Federal congressional district</p>
      ) : null}
    </section>
  );
}
