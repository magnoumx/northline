-- Preview-only cleanup for the known fictional signal used during early setup.
-- It deletes the row only when no real observation was ever attached and no
-- story cluster depends on it. Do not run this file against production unless
-- the same conditions have been reviewed deliberately.

DELETE FROM story_opportunities
WHERE trend_id IN (
  SELECT t.id
  FROM trends t
  WHERE lower(t.original_term) = 'heat dome weather'
    AND t.story_cluster_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM trend_signal_observations o
      WHERE o.normalized_topic = t.normalized_term
    )
);

DELETE FROM trends
WHERE lower(original_term) = 'heat dome weather'
  AND story_cluster_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM trend_signal_observations o
    WHERE o.normalized_topic = trends.normalized_term
  );
