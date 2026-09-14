/**
 * Compatibility barrel for existing Newsroom routes.
 *
 * The implementation now lives in focused modules under components/newsroom
 * so the protected shell, editorial demos, operational placeholders, and
 * database-backed advertising readers can evolve independently.
 */
export { ArticleEditor } from "./newsroom/article-editor";
export { NewsroomDashboard } from "./newsroom/dashboard";
export { ResearchDesk } from "./newsroom/research-desk";
export { ReviewWorkspace } from "./newsroom/review-workspace";
export { TrendDesk } from "./newsroom/trend-desk";
export { IntelligenceWorkbench } from "./newsroom/intelligence-workbench";
export {
  NewsroomUtilityPage,
  newsroomUtilitySections,
} from "./newsroom/utility-page";
