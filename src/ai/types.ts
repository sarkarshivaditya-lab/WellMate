// src/ai/types.ts
// Shared type contracts for the AI interface preparation layer.
// Pure data — no side effects, no React, no state.

import type { MemoryDomain, ConfidenceLevel } from "@/intelligence/memory/types";

// ── Citations ─────────────────────────────────────────────────────────────────
// A traceable piece of evidence grounding an AI insight or recommendation.

export type CitationType = "behavioral" | "trend" | "milestone" | "correlation" | "score";

export type Citation = {
  id: string;
  type: CitationType;
  domain: MemoryDomain;
  text: string;               // "Sleep consistency up 23% over 30 days"
  confidence: ConfidenceLevel;
  windowDays: number;
  dataPoints: number;         // how many log entries back this claim
};

// ── Context cards ─────────────────────────────────────────────────────────────
// Self-contained intelligence summaries — the semantic units of AI context.

export type ContextCardType =
  | "sleep_trend"
  | "behavioral_shift"
  | "recovery_state"
  | "mood_pattern"
  | "habit_momentum"
  | "nutrition_pattern"
  | "milestone"
  | "correlation";

export type ContextCard = {
  id: string;
  type: ContextCardType;
  domain: MemoryDomain;
  headline: string;
  detail?: string;
  citations: Citation[];
  confidence: ConfidenceLevel;
  relevance: number;          // 0–1, used for budget prioritization
  followUps: string[];        // suggested follow-up questions for UI chips
};

// ── Conversational entry points ───────────────────────────────────────────────
// Grounded follow-up prompts seeded throughout the UI.

export type FollowUpPrompt = {
  id: string;
  text: string;               // "What's affecting my sleep consistency?"
  domain: MemoryDomain | "composite";
  category: "why" | "how" | "what" | "trend";
  grounding?: string;         // brief context injected alongside the prompt
};

// ── AI context payload ────────────────────────────────────────────────────────
// The assembled, token-budgeted context produced by contextBridge.

export type AIContextSection = {
  label: string;
  content: string;
  tokenEstimate: number;
  weight: number;             // 0–1
};

export type AIContextPayload = {
  systemContext: string;      // assembled prose, ready for AI injection
  sections: AIContextSection[];
  activeTopics: MemoryDomain[];
  topInsight: string;
  generatedAt: number;        // Unix ms
  dataSpanDays: number;
};
