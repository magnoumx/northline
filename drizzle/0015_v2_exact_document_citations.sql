-- v2: a publisher is not a document. Multiple exact pages from one publisher
-- may support the same article, so citation identity is version + source_url.
DROP INDEX IF EXISTS article_source_links_version_source_uq;

CREATE UNIQUE INDEX IF NOT EXISTS article_source_links_version_url_uq
  ON article_source_links(article_version_id, source_url)
  WHERE source_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS article_source_links_version_source_idx
  ON article_source_links(article_version_id, source_id);
