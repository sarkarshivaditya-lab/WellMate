import { isInFirstWeek, getDaysSinceFirstOpen } from "@/data/local/firstOpenStore";

/**
 * Returns whether the user is within their first 7 days.
 * Synchronous localStorage read — stable for the lifetime of a session.
 */
export function useFirstWeek(): {
  isFirstWeek: boolean;
  daysSinceStart: number;
} {
  const daysSinceStart = getDaysSinceFirstOpen();
  return { isFirstWeek: isInFirstWeek(), daysSinceStart };
}
