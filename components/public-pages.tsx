/**
 * Compatibility surface for the catch-all route. Public V2 page implementations
 * live in focused domain modules so route changes do not recreate a monolith.
 */
export {
  LatestPage,
  LiveBlogPage,
  LiveIndexPage,
  SearchPage,
  TopicPage,
  TrendingPage,
} from "./public/feed-pages";
export {
  DirectoryPage,
  NewsletterPage,
  PersonalPage,
  PolicyPage,
} from "./public/info-pages";
export {
  StandardArticlePage,
  StoryIntelligencePage,
} from "./public/story-pages";
