import type { Metadata } from "next";
import { BookOpen, Brain, FileCheck2, Lock, ShieldAlert, Scale } from "lucide-react";
import { TopIdentity } from "../../components/mobile/TopIdentity";

export const metadata: Metadata = {
  title: "Methodology",
};

const cards = [
  {
    icon: FileCheck2,
    title: "Sources first",
    body: "Facts about bills, representatives, votes, and government actions need source citations. If sources are thin, CivicLens says so.",
  },
  {
    icon: Brain,
    title: "AI has limits",
    body: "The app explains source context in plain English, but it does not invent missing facts or treat model output as evidence.",
  },
  {
    icon: Lock,
    title: "Privacy",
    body: "Addresses are used only for lookup. Claim text is minimized by default and not kept as a social profile or public post.",
  },
  {
    icon: Scale,
    title: "Neutrality",
    body: "CivicLens does not recommend parties, candidates, voting choices, campaign strategy, or persuasion copy.",
  },
  {
    icon: ShieldAlert,
    title: "What it refuses",
    body: "Requests for propaganda, targeting, voting advice, or campaign messaging are redirected to neutral civic explanation.",
  },
  {
    icon: BookOpen,
    title: "How citations work",
    body: "Source cards show where an answer came from, and dense details stay available behind source controls.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="page-shell">
      <TopIdentity title="Methodology" subtitle="How CivicLens keeps learning useful and careful." />

      <section className="grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="info-row" key={card.title}>
              <span className="info-icon" aria-hidden="true">
                <Icon />
              </span>
              <div>
                <h2 className="section-title">{card.title}</h2>
                <p>{card.body}</p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
