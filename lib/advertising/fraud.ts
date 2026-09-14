export interface TrafficSignals {
  userAgent: string;
  isInternalAddress: boolean;
  isAdminSession: boolean;
  eventsForToken: number;
  requestsForAddressInMinute: number;
  impressions: number;
  clicks: number;
  dataCenterAddress: boolean;
}

export interface TrafficDecision {
  excluded: boolean;
  riskScore: number;
  reasons: string[];
  classification: "HUMAN_LIKELY" | "CRAWLER" | "INTERNAL" | "SUSPICIOUS";
}

const crawlerPattern =
  /bot|crawler|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit/i;

export function classifyTraffic(signals: TrafficSignals): TrafficDecision {
  const reasons: string[] = [];
  let score = 0;
  if (signals.isInternalAddress || signals.isAdminSession) {
    return {
      excluded: true,
      riskScore: 100,
      reasons: ["INTERNAL_OR_ADMIN_TRAFFIC"],
      classification: "INTERNAL",
    };
  }
  if (crawlerPattern.test(signals.userAgent) || !signals.userAgent.trim()) {
    return {
      excluded: true,
      riskScore: 100,
      reasons: ["CRAWLER_OR_MISSING_USER_AGENT"],
      classification: "CRAWLER",
    };
  }
  if (signals.eventsForToken > 1) {
    score += 60;
    reasons.push("TOKEN_REPLAY");
  }
  if (signals.requestsForAddressInMinute > 120) {
    score += 35;
    reasons.push("IMPOSSIBLE_VOLUME");
  }
  if (signals.dataCenterAddress) {
    score += 20;
    reasons.push("DATA_CENTER_TRAFFIC");
  }
  const ctr = signals.impressions > 0 ? signals.clicks / signals.impressions : 0;
  if (signals.impressions >= 20 && ctr > 0.35) {
    score += 35;
    reasons.push("SUSPICIOUS_CTR");
  }
  score = Math.min(100, score);
  return {
    excluded: score >= 60,
    riskScore: score,
    reasons,
    classification: score >= 40 ? "SUSPICIOUS" : "HUMAN_LIKELY",
  };
}

