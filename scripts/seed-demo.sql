INSERT OR IGNORE INTO users (
  id, email, display_name, role, status, created_at, updated_at
) VALUES (
  'demo-editor',
  'editor@northline.example',
  'Morgan Cole',
  'Managing Editor',
  'active',
  unixepoch() * 1000,
  unixepoch() * 1000
);

INSERT OR IGNORE INTO story_clusters (
  id, slug, title, category, status, plain_summary,
  latest_confirmed_development, latest_update_at, created_at, updated_at
) VALUES (
  'demo-cluster-batteries',
  'neighborhood-batteries-heat-grid',
  'Neighborhood battery pilots',
  'Science',
  'developing',
  'Fictional demo dossier for a community-storage pilot.',
  'Preliminary operating readings were added to the demo dossier.',
  unixepoch() * 1000,
  unixepoch() * 1000,
  unixepoch() * 1000
);

INSERT OR IGNORE INTO sources (
  id, name, domain, publisher, source_type, country, ownership,
  credibility_tier, is_primary, citation_requirements, licensing_status,
  reliability_notes, last_reviewed_at, created_at, updated_at
) VALUES (
  'demo-source-grid',
  'Lake Union Energy Cooperative',
  'lake-union-energy.example',
  'Lake Union Energy Cooperative',
  'official_record',
  'US',
  'Fictional member cooperative',
  1,
  1,
  'Identify as fictional demo primary record',
  'demo_only',
  'Fixture only; not a real-world source',
  unixepoch() * 1000,
  unixepoch() * 1000,
  unixepoch() * 1000
);

INSERT OR IGNORE INTO connectors (
  id, source_name, connector_type, permitted_usage, rate_limits_json,
  attribution_rules, caching_rules, supported_markets_json,
  supported_categories_json, failure_count, circuit_breaker_status,
  health_score, created_at, updated_at
) VALUES (
  'demo-connector',
  'Fictional official-feed adapter',
  'fixture',
  'Local demo data only',
  '{"requestsPerMinute":0}',
  'Label all records as fictional demo content',
  'Static fixture',
  '["US"]',
  '["Science","Technology"]',
  0,
  'CLOSED',
  100,
  unixepoch() * 1000,
  unixepoch() * 1000
);
