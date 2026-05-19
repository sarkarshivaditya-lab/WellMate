const HISTORY_KEY = "wellmate_weight_history_v1";
const MAX_ENTRIES = 365;

export type WeightEntry = {
  kg: number;
  date: string; // "YYYY-MM-DD"
};

export function readWeightHistory(): WeightEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WeightEntry[];
  } catch {
    return [];
  }
}

export function appendWeightEntry(kg: number): void {
  try {
    const history = readWeightHistory();
    const today = new Date().toISOString().split("T")[0];
    const idx = history.findIndex((e) => e.date === today);
    if (idx >= 0) {
      history[idx] = { kg, date: today };
    } else {
      history.push({ kg, date: today });
    }
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-MAX_ENTRIES)),
    );
  } catch {
    // swallow
  }
}
