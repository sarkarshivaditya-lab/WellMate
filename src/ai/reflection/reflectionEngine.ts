// Reflection engine — assembles context, runs inference, filters output, caches result.
//
// Consumers call generateDailyReflection() or generateJournalReflection() and
// receive a streaming result via onToken + a final ReflectionResult.
//
// The engine is the single integration point for:
//   presence rules → retrieval → prompts → inference → safety filter → cache

import { evaluatePresence } from "../presence/presenceRules";
import { filterOutput } from "../safety/outputFilter";
import {
  buildDailyReflectionPrompt,
  buildJournalReflectionPrompt,
  WELLMATE_IDENTITY_PROMPT,
} from "./reflectionPrompts";
import {
  getStoredReflection,
  storeReflection,
  isReflectionStale,
} from "./reflectionStore";
import type { ReflectionType } from "./reflectionStore";
import { retrievalBridge } from "../retrieval/retrievalBridge";
import { serializeSummaryForPrompt } from "../memory/longitudinalSummary";
import { submitInference } from "../orchestration/orchestrator";

export type ReflectionResult = {
  text: string;
  confidence: number;
  safetyScore: number;
  fromCache: boolean;
};

type GenerateOpts = {
  force?: boolean;
  onToken?: (token: string) => void;
};

async function runInference(opts: {
  prompt: string;
  maxTokens: number;
  temperature: number;
  onToken?: (token: string) => void;
}): Promise<string> {
  const controller = new AbortController();

  const result = await submitInference({
    id: crypto.randomUUID(),
    prompt: opts.prompt,
    systemContext: WELLMATE_IDENTITY_PROMPT,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    priority: "low",
    controller,
    onToken: opts.onToken,
  });

  return result.text.trim();
}

export async function generateDailyReflection(
  opts?: GenerateOpts,
): Promise<ReflectionResult | null> {
  if (!opts?.force) {
    const cached = getStoredReflection("daily");
    if (cached) {
      return {
        text: cached.text,
        confidence: cached.confidence,
        safetyScore: cached.safetyScore,
        fromCache: true,
      };
    }
  }

  const presence = evaluatePresence();
  if (!presence.show && !opts?.force) return null;

  // Assemble grounding context
  const parts: string[] = [];

  const summaryText = serializeSummaryForPrompt();
  if (summaryText) parts.push(summaryText);

  const retrieved = await retrievalBridge.query({
    text: "mood patterns sleep energy emotional state recent habits",
    scope: ["mood_history", "sleep_history", "habit_history", "journal_entries"],
    topK: 6,
    minScore: 0.15,
  });

  if (retrieved.chunks.length > 0) {
    const deduped = deduplicateChunks(retrieved.chunks.slice(0, 5));
    parts.push(`Recent patterns:\n${deduped.map((c) => c.content).join("\n")}`);
  }

  if (parts.length === 0) return null;

  const contextSummary = parts.join("\n\n");
  const prompt = buildDailyReflectionPrompt(contextSummary);

  try {
    const rawText = await runInference({
      prompt,
      maxTokens: 128,
      temperature: 0.65,
      onToken: opts?.onToken,
    });

    const safety = filterOutput(rawText);
    if (!safety.safe || !safety.text) return null;

    storeReflection({
      type: "daily",
      text: safety.text,
      generatedAt: Date.now(),
      confidence: presence.confidence,
      safetyScore: safety.score,
    });

    return {
      text: safety.text,
      confidence: presence.confidence,
      safetyScore: safety.score,
      fromCache: false,
    };
  } catch {
    return null;
  }
}

export async function generateJournalReflection(
  opts?: GenerateOpts,
): Promise<ReflectionResult | null> {
  if (!opts?.force) {
    const cached = getStoredReflection("journal");
    if (cached) {
      return {
        text: cached.text,
        confidence: cached.confidence,
        safetyScore: cached.safetyScore,
        fromCache: true,
      };
    }
  }

  const retrieved = await retrievalBridge.query({
    text: "emotional themes reflections feelings recurring concerns",
    scope: ["journal_entries"],
    topK: 6,
    minScore: 0.1,
  });

  if (retrieved.chunks.length < 2) return null;

  const deduped = deduplicateChunks(retrieved.chunks.slice(0, 5));
  const journalContext = deduped.map((c) => c.content).join("\n\n");
  const prompt = buildJournalReflectionPrompt(journalContext);

  try {
    const rawText = await runInference({
      prompt,
      maxTokens: 96,
      temperature: 0.6,
      onToken: opts?.onToken,
    });

    const safety = filterOutput(rawText);
    if (!safety.safe || !safety.text) return null;

    storeReflection({
      type: "journal",
      text: safety.text,
      generatedAt: Date.now(),
      confidence: 0.7,
      safetyScore: safety.score,
    });

    return {
      text: safety.text,
      confidence: 0.7,
      safetyScore: safety.score,
      fromCache: false,
    };
  } catch {
    return null;
  }
}

// Remove chunks whose content is near-duplicate (prefix overlap > 80%)
function deduplicateChunks(
  chunks: { content: string; score: number }[],
): { content: string; score: number }[] {
  const seen: string[] = [];
  return chunks.filter((chunk) => {
    const key = chunk.content.slice(0, 80).toLowerCase();
    if (seen.some((s) => similarity(s, key) > 0.8)) return false;
    seen.push(key);
    return true;
  });
}

// Simple character-overlap similarity for near-duplicate detection
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) matches++;
  }
  return matches / longer.length;
}

export { isReflectionStale, getStoredReflection };
export type { ReflectionType };
