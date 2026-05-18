// src/search/searchTypes.ts
// Shared type contracts for universal search and retrieval.

export type SearchModule =
  | "meal"
  | "exercise"
  | "sleep"
  | "mood"
  | "journal"
  | "habit"
  | "navigation"
  | "action";

export type SearchResult = {
  id: string;
  module: SearchModule;
  title: string;
  subtitle?: string;
  dateIso?: string;
  timestamp?: number;
  route?: string;
  action?: () => void;
  score: number;
};

export type SearchGroup = {
  label: string;
  module: SearchModule;
  results: SearchResult[];
};
