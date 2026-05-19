// Provider registry and active-provider management.
// The orchestrator is the only caller — no component should touch this directly.

import type { AIProvider } from "./types";
import type { ProviderType } from "../runtime/types";

const _providers = new Map<ProviderType, AIProvider>();
let _active: ProviderType | null = null;

export function registerProvider(provider: AIProvider): void {
  _providers.set(provider.type, provider);
}

export function setActiveProvider(type: ProviderType): void {
  if (!_providers.has(type)) {
    throw new Error(`Provider "${type}" is not registered`);
  }
  _active = type;
}

export function getActiveProvider(): AIProvider | null {
  if (!_active) return null;
  return _providers.get(_active) ?? null;
}

export function getProvider(type: ProviderType): AIProvider | undefined {
  return _providers.get(type);
}

export function listRegisteredProviders(): ProviderType[] {
  return Array.from(_providers.keys());
}

export function clearProviders(): void {
  _providers.clear();
  _active = null;
}
