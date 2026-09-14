"use client";

import { ArrowUp, Bot, Quote, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Story } from "@/lib/site/types";

type Exchange = {
  question: string;
  answer: string;
};

export function AskStory({ story }: { story: Story }) {
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [loading, setLoading] = useState(false);

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") ?? "").trim();
    if (!question) return;
    setLoading(true);
    window.setTimeout(() => {
      const lower = question.toLowerCase();
      let answer =
        "That answer is not available in this verified demo dossier. The product will not browse uncontrolled sources or fill the gap with speculation.";
      if (lower.includes("matter") || lower.includes("important")) {
        answer = story.whyItMatters;
      } else if (
        lower.includes("next") ||
        lower.includes("happen") ||
        lower.includes("when")
      ) {
        answer = story.next;
      } else if (
        lower.includes("confirm") ||
        lower.includes("know") ||
        lower.includes("fact")
      ) {
        answer = `${story.keyFacts.slice(0, 2).join(" ")} These points are supported by the primary records in the demo dossier.`;
      } else if (lower.includes("trend") || lower.includes("popular")) {
        answer = story.whyTrending;
      }
      setExchange({ question, answer });
      setLoading(false);
    }, 350);
    event.currentTarget.reset();
  }

  return (
    <section className="ask-story" aria-labelledby="ask-story-title">
      <div className="ask-story__head">
        <div>
          <Bot size={21} />
          <div>
            <p>VERIFIED DOSSIER ONLY</p>
            <h2 id="ask-story-title">Ask this story</h2>
          </div>
        </div>
        <span>
          <ShieldCheck size={14} /> Answers map to the stored demo dossier
        </span>
      </div>
      <p>
        Ask about confirmed facts, why this matters, or what happens next. This
        demo never searches the open web during your question.
      </p>
      <div className="ask-story__prompts">
        {["Why does this matter?", "What is confirmed?", "What happens next?"].map(
          (prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                const answer = prompt.startsWith("Why")
                  ? story.whyItMatters
                  : prompt.includes("confirmed")
                    ? `${story.keyFacts.slice(0, 2).join(" ")}`
                    : story.next;
                setExchange({ question: prompt, answer });
              }}
            >
              {prompt}
            </button>
          ),
        )}
      </div>
      {exchange ? (
        <div className="ask-story__answer">
          <p className="ask-story__question">{exchange.question}</p>
          <p>{exchange.answer}</p>
          <span>
            <Quote size={13} /> Mapped to {story.sources[0].name} and its
            internal demo source record
          </span>
        </div>
      ) : null}
      <form onSubmit={ask}>
        <label>
          <span className="sr-only">Ask a question about this story</span>
          <input
            name="question"
            maxLength={180}
            placeholder="Ask a question about this story…"
          />
        </label>
        <button type="submit" disabled={loading} aria-label="Ask question">
          <ArrowUp size={18} />
        </button>
      </form>
    </section>
  );
}
