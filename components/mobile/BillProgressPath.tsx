const steps = ["Introduced", "Committee", "House", "Senate", "Law"];

export function BillProgressPath({ currentStep = 1 }: { currentStep?: number }) {
  const safeStep = Math.min(Math.max(Math.round(currentStep), 0), steps.length - 1);

  return (
    <ol className="bill-progress-path" aria-label="Bill progress">
      {steps.map((step, index) => {
        const active = index <= safeStep;
        const current = index === safeStep;
        return (
          <li
            key={step}
            className={`${active ? "active" : ""}${current ? " current" : ""}`}
            aria-current={current ? "step" : undefined}
          >
            <span>{index + 1}</span>
            <small>{step}</small>
          </li>
        );
      })}
    </ol>
  );
}
