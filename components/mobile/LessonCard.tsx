import { AssetIcon } from "../AssetIcon";
import { Pill } from "./Pill";

export function LessonCard({
  title,
  body,
  asset,
  category,
  steps,
}: {
  title: string;
  body: string;
  asset?: string;
  category?: string;
  steps?: string[];
}) {
  return (
    <article className="lesson-card">
      <div className="lesson-copy">
        <Pill tone="teal">Lesson</Pill>
        {category ? <span className="lesson-category">{category}</span> : null}
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <AssetIcon asset={asset} alt="" decorative size={172} priority />
      {steps?.length ? (
        <ol className="lesson-steps" aria-label="Lesson steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <small>{step}</small>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
