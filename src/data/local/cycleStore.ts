export type LocalCycle = {
  localId: string;
  startDateIso: string;
  lengthDays?: number;
  notes?: string;
  updatedAt: number;
};

const CYCLE_KEY = "local_cycles";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listCycles(): LocalCycle[] {
  const cycles = load<LocalCycle[]>(CYCLE_KEY, []);
  return cycles.slice().sort((a, b) =>
    b.startDateIso.localeCompare(a.startDateIso),
  );
}

export function addCycle(input: {
  startDateIso: string;
  lengthDays?: number;
  notes?: string;
}) {
  const cycles = load<LocalCycle[]>(CYCLE_KEY, []);
  const now = Date.now();

  cycles.push({
    localId: crypto.randomUUID(),
    startDateIso: input.startDateIso,
    lengthDays: input.lengthDays,
    notes: input.notes,
    updatedAt: now,
  });

  save(CYCLE_KEY, cycles);
}

export function deleteCycle(localId: string) {
  const cycles = load<LocalCycle[]>(CYCLE_KEY, []);
  save(
    CYCLE_KEY,
    cycles.filter((c) => c.localId !== localId),
  );
}
