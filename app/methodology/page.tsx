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
    body: "A configured LLM can explain supplied source context in plain English. Without a provider, explanations use guided templates. Either can make mistakes: a valid citation ID does not prove that every sentence follows from its source.",
  },
  {
    icon: Lock,
    title: "Privacy",
    body: "An address is sent to the U.S. Census Geocoder only for district lookup; it is not stored or sent to an LLM. Claims sent for live analysis go to the configured model provider. Progress stays in this browser, and claim storage is disabled by default.",
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
  {
    icon: BookOpen,
    title: "Practice with honest progress",
    body: "Lessons combine teaching cards, application questions, and official source links. Complete every check to unlock the next lesson. XP is earned once per lesson; missed concepts return in a review queue. Clearing browser storage removes your progress.",
  },
  {
    icon: FileCheck2,
    title: "Snapshots and live records",
    body: "Curated bill records and the explicit sample district are dated examples, not current-data guarantees. Live records depend on provider availability. A search result points to a place to investigate; it does not establish a claim by itself.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="page-shell">
      <TopIdentity title="Methodology" subtitle="How CivicLens keeps learning useful and careful." />
      <h1 className="section-title">How CivicLens works</h1>

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
