import type {
  InternalLinkSuggestion,
  KnowledgeEntity,
  KnowledgeStory,
} from "./types";

export type LinkSuggestionInput = {
  sourceStory: KnowledgeStory;
  candidateStories: readonly KnowledgeStory[];
  entities: readonly KnowledgeEntity[];
  sourceWordCount: number;
};

/**
 * Suggests links from shared, explicit entities. A human must confirm that the
 * target adds context at the first useful mention. The density cap follows the
 * editorial guideline of three to six useful links per 1,000 words.
 */
export function suggestInternalLinks({
  sourceStory,
  candidateStories,
  entities,
  sourceWordCount,
}: LinkSuggestionInput): readonly InternalLinkSuggestion[] {
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const sourceEntities = new Set(sourceStory.entityIds);
  const maximumSuggestions = Math.max(
    1,
    Math.min(6, Math.floor((sourceWordCount / 1000) * 6)),
  );

  return candidateStories
    .filter((story) => story.id !== sourceStory.id)
    .map((story): InternalLinkSuggestion | null => {
      const sharedEntityIds = story.entityIds.filter((id) =>
        sourceEntities.has(id),
      );
      const anchorEntity = entityMap.get(sharedEntityIds[0] ?? "");
      if (!anchorEntity) return null;
      const confidence = Math.min(96, 54 + sharedEntityIds.length * 13);
      return {
        id: `link-${sourceStory.id}-${story.id}`,
        sourceStoryId: sourceStory.id,
        targetStoryId: story.id,
        anchorText: anchorEntity.label,
        insertionContext: `Review the first useful mention of ${anchorEntity.label}; add only if the target supplies necessary context.`,
        sharedEntityIds: [...sharedEntityIds],
        confidence,
        reasons: [
          `${sharedEntityIds.length} explicitly shared ${sharedEntityIds.length === 1 ? "entity" : "entities"}.`,
          `The target supplies prior reporting context about ${anchorEntity.label}.`,
        ],
        status: "SUGGESTED" as const,
        disclosure: "FICTIONAL_INTERNAL_DEMO" as const,
      };
    })
    .filter(
      (suggestion): suggestion is InternalLinkSuggestion =>
        suggestion !== null,
    )
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, maximumSuggestions);
}
