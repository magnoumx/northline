import type { HeadlineCandidate, HeadlineStrategy } from "./types";

type HeadlineStoryInput = {
  subject: string;
  verifiedAction: string;
  readerImpact: string;
  location: string;
  timing: string;
};

const strategyTemplates: Readonly<
  Record<HeadlineStrategy, readonly ((story: HeadlineStoryInput) => string)[]>
> = {
  DIRECT: [
    (story) => `${story.subject} ${story.verifiedAction} in ${story.location}`,
    (story) => `${story.location} ${story.subject} ${story.verifiedAction}`,
    (story) => `${story.subject} ${story.verifiedAction}; ${story.readerImpact}`,
    (story) => `${story.timing}: ${story.subject} ${story.verifiedAction}`,
  ],
  EXPLANATORY: [
    (story) => `Why ${story.subject} ${story.verifiedAction} in ${story.location}`,
    (story) => `What ${story.subject}'s plan means for ${story.readerImpact}`,
    (story) => `How ${story.subject} plans to ${story.verifiedAction}`,
    (story) => `The context behind ${story.subject}'s ${story.location} plan`,
  ],
  SERVICE: [
    (story) => `What to know about ${story.subject}'s ${story.location} plan`,
    (story) => `${story.readerImpact}: what changes under the new plan`,
    (story) => `A guide to ${story.subject}'s proposal in ${story.location}`,
    (story) => `Key dates in ${story.subject}'s ${story.location} proposal`,
  ],
  CONTEXT: [
    (story) => `${story.subject}'s proposal, in context`,
    (story) => `What came before ${story.subject}'s ${story.location} plan`,
    (story) => `Five facts that frame ${story.subject}'s new proposal`,
    (story) => `The policy choices behind ${story.subject}'s proposal`,
  ],
  QUESTION_ANSWERED: [
    (story) => `Will ${story.subject}'s plan affect ${story.readerImpact}?`,
    (story) => `Who is affected by ${story.subject}'s ${story.location} plan?`,
    (story) => `When could ${story.subject}'s proposal take effect?`,
    (story) => `What remains undecided in ${story.subject}'s proposal?`,
  ],
  TIMELINE: [
    (story) => `How ${story.subject}'s ${story.location} proposal developed`,
    (story) => `Timeline: the path to ${story.subject}'s new plan`,
    (story) => `From draft to vote: ${story.subject}'s proposal`,
    (story) => `What happens next for ${story.subject}'s ${story.location} plan`,
  ],
};

/**
 * Produces 24 varied, deterministic candidates for protected human review.
 * Scores are internal heuristics, not predicted audience performance.
 */
export function generateHeadlineCandidates(
  story: HeadlineStoryInput,
): readonly HeadlineCandidate[] {
  return (Object.entries(strategyTemplates) as [
    HeadlineStrategy,
    readonly ((story: HeadlineStoryInput) => string)[],
  ][]).flatMap(([strategy, templates], strategyIndex) =>
    templates.map((template, templateIndex) => {
      const index = strategyIndex * 4 + templateIndex;
      const text = template(story);
      const hardRejectReason =
        strategy === "QUESTION_ANSWERED" && templateIndex === 0
          ? "Question framing could imply an answer that reporting has not established."
          : null;
      const clarity = 72 + ((index * 7) % 25);
      const specificity = 69 + ((index * 11) % 28);
      const accuracy = hardRejectReason ? 42 : 82 + ((index * 5) % 16);
      const usefulness = 70 + ((index * 13) % 27);
      const internalScore = Math.round(
        clarity * 0.3 +
          specificity * 0.25 +
          accuracy * 0.3 +
          usefulness * 0.15,
      );
      return {
        id: `headline-${String(index + 1).padStart(2, "0")}`,
        text,
        strategy,
        clarity,
        specificity,
        accuracy,
        usefulness,
        internalScore,
        hardRejectReason,
        disclosure: "FICTIONAL_INTERNAL_DEMO" as const,
      };
    }),
  );
}
