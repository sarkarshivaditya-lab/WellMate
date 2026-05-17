const KEY = "wellmate_first_open";
const MS_PER_DAY = 86_400_000;

/** Returns the epoch ms when the user first opened the app. Records it on first call. */
export function getFirstOpenDate(): number {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return Number(stored);
    const now = Date.now();
    localStorage.setItem(KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export function getDaysSinceFirstOpen(): number {
  return Math.floor((Date.now() - getFirstOpenDate()) / MS_PER_DAY);
}

export function isInFirstWeek(): boolean {
  return getDaysSinceFirstOpen() < 7;
}
