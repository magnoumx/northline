/**
 * States how an article was actually produced.
 *
 * The publication displayed "Standards Desk" as the reviewer of every story and
 * emitted a matching `reviewedBy` in structured data. No such desk exists and
 * no review record backed it: across twenty published articles there were zero
 * reviewer assignments. That is a false claim to readers and to search engines,
 * and it is the one defect that would cost the publication its credibility
 * outright.
 *
 * The rule here is narrow and absolute: a person is named only when a record
 * names them. Where no human was involved, the disclosure says so plainly
 * rather than reaching for a comfortable phrase.
 */

export type WorkflowFacts = {
  /** Byline recorded on the article. */
  author: string | null;
  /** A real human review assignment, if one exists. */
  humanReviewer: string | null;
  /** The actor recorded on the approval event. */
  approvedBy: string | null;
  /** Provider that drafted the article, when it was model-drafted. */
  draftingProvider: string | null;
  /** Provider that performed independent fact review, if different. */
  factReviewProvider: string | null;
};

export type WorkflowDisclosure = {
  /** Sentence shown to the reader. */
  statement: string;
  /** True only when a named person reviewed the article. */
  humanReviewed: boolean;
  /**
   * True only when fact review ran on a different provider than drafting.
   * Independence cannot be claimed from a single provider run.
   */
  independentModelReview: boolean;
};

const AUTOMATED_ACTORS = new Set([
  "system:autonomous",
  "system:autopublish",
  "system:jobs",
  "system:media",
]);

function isAutomated(actor: string | null): boolean {
  if (!actor) return true;
  return AUTOMATED_ACTORS.has(actor) || actor.startsWith("system:");
}

export function describeWorkflow(facts: WorkflowFacts): WorkflowDisclosure {
  const humanReviewer = facts.humanReviewer?.trim() || null;
  const approver = isAutomated(facts.approvedBy) ? null : facts.approvedBy;
  const drafted = facts.draftingProvider?.trim() || null;
  const reviewed = facts.factReviewProvider?.trim() || null;

  // Independence is a claim about execution, not about intent. It holds only
  // when a second provider actually ran and differed from the first.
  const independentModelReview = Boolean(
    drafted &&
      reviewed &&
      reviewed !== "not-run" &&
      reviewed !== drafted,
  );

  if (humanReviewer) {
    const base = drafted
      ? `Written with AI assistance and reviewed by ${humanReviewer}.`
      : `Reported and written by ${facts.author ?? "a Northline journalist"}, reviewed by ${humanReviewer}.`;
    return { statement: base, humanReviewed: true, independentModelReview };
  }

  if (approver) {
    return {
      statement: `Produced through Northline's autonomous editorial workflow and approved for publication by ${approver}.`,
      humanReviewed: true,
      independentModelReview,
    };
  }

  if (!drafted) {
    return {
      statement: `Reported and written by ${facts.author ?? "a Northline journalist"}.`,
      humanReviewed: false,
      independentModelReview: false,
    };
  }

  return {
    statement: independentModelReview
      ? "Produced through Northline's autonomous editorial workflow and independently checked by a separate model. No human review was performed before publication."
      : "Produced through Northline's autonomous editorial workflow. No human review was performed before publication.",
    humanReviewed: false,
    independentModelReview,
  };
}
