import { IconCheck } from "./Icons";

export type StepNumber = 1 | 2 | 3;

const STEPS: { n: StepNumber; title: string; meta: string }[] = [
  { n: 1, title: "Upload PDF", meta: "Combined label + invoice" },
  { n: 2, title: "Review crop", meta: "Check every page" },
  { n: 3, title: "Download labels", meta: "One 4 × 6 PDF" },
];

/** Three-step progress indicator — the current step is highlighted and marked
 *  with aria-current="step" for assistive tech. */
export default function Stepper({ current }: { current: StepNumber }) {
  return (
    <ol className="stepper">
      {STEPS.map((step) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <li
            key={step.n}
            className={`step${done ? " step--done" : ""}${active ? " step--active" : ""}`}
            aria-current={active ? "step" : undefined}
          >
            <span className="step__index" aria-hidden="true">
              {done ? <IconCheck width={14} height={14} /> : step.n}
            </span>
            <span className="step__text">
              <span className="step__title">{step.title}</span>
              <span className="step__meta">
                {done ? "Done · " : active ? "Current step · " : ""}
                {step.meta}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
