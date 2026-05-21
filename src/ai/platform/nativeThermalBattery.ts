// Native Thermal + Battery Integration — moves beyond browser heuristics.
//
// Priority chain for thermal state:
//   1. ThermalPlugin (iOS 16+ native thermal state API)
//   2. Sustained inference rate heuristic (thermalGuard.ts fallback)
//
// Priority chain for battery state:
//   1. BatteryPlugin (Capacitor — accurate native battery API)
//   2. navigator.getBattery() (Web Battery API — deprecated but available on Chrome)
//   3. Safe defaults (100% / charging / unknown)
//
// Thermal normalization from iOS → WellMate states:
//   iOS nominal → nominal
//   iOS fair    → warm
//   iOS serious → hot
//   iOS critical → critical
//
// Escalation prediction: if thermal has risen 2+ levels in last 4 samples → at risk

import { getThermalState } from "../runtime/thermalGuard";
import type { ThermalState } from "../runtime/types";
import { getThermalTrend } from "../runtime/hardwareCharacterizer";
import { getThermalPlugin, getBatteryPlugin } from "./nativePluginContracts";
import type { CognitionQuality } from "../cognition/cognitionScaler";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ThermalRisk = "low" | "moderate" | "high" | "critical";

export type ChargingPolicy = {
  recommended: CognitionQuality;
  reason: string;
  allowHeavySessions: boolean;
};

export type NativeThermalBatteryState = {
  thermalState: ThermalState;
  thermalSource: "native_plugin" | "heuristic";
  thermalRisk: ThermalRisk;
  thermalEscalating: boolean;
  batteryLevel: number;       // 0-100
  isCharging: boolean;
  lowPowerMode: boolean;
  batterySource: "native_plugin" | "web_battery_api" | "default";
  chargingPolicy: ChargingPolicy;
  sustainedHeatRiskScore: number; // 0-100
  sampledAt: number;
};

const CACHE_KEY = "ai_native_thermal_battery_v1";
const CACHE_TTL_MS = 10_000; // 10s — thermal state changes slowly

// ── iOS thermal mapping ────────────────────────────────────────────────────────

const IOS_THERMAL_MAP: Record<string, ThermalState> = {
  nominal: "nominal",
  fair: "warm",
  serious: "hot",
  critical: "critical",
};

function normalizeIosThermal(state: string): ThermalState {
  return IOS_THERMAL_MAP[state] ?? "nominal";
}

// ── Thermal risk scoring ──────────────────────────────────────────────────────

const RISK_BY_STATE: Record<ThermalState, ThermalRisk> = {
  nominal: "low",
  warm: "moderate",
  hot: "high",
  critical: "critical",
  emergency: "critical",
};

function computeSustainedHeatRisk(thermalState: ThermalState, escalating: boolean): number {
  const base = { nominal: 0, warm: 25, hot: 55, critical: 80, emergency: 100 }[thermalState] ?? 0;
  return Math.min(100, base + (escalating ? 20 : 0));
}

// ── Charging policy ───────────────────────────────────────────────────────────

function deriveChargingPolicy(
  isCharging: boolean,
  batteryLevel: number,
  thermalState: ThermalState,
): ChargingPolicy {
  if (thermalState === "critical" || thermalState === "emergency") {
    return { recommended: "minimal", reason: "critical thermal — minimizing cognition load", allowHeavySessions: false };
  }
  if (thermalState === "hot") {
    return { recommended: "efficient", reason: "elevated thermal — throttling inference", allowHeavySessions: false };
  }
  if (isCharging) {
    return { recommended: "deep_reflection", reason: "charging — full capability available", allowHeavySessions: true };
  }
  if (batteryLevel < 15) {
    return { recommended: "minimal", reason: "battery critical — conserving power", allowHeavySessions: false };
  }
  if (batteryLevel < 30) {
    return { recommended: "efficient", reason: "battery low — reducing inference load", allowHeavySessions: false };
  }
  return { recommended: "balanced", reason: "normal unplugged operation", allowHeavySessions: batteryLevel > 50 };
}

// ── Native state fetch ────────────────────────────────────────────────────────

async function fetchNativeThermal(): Promise<{ state: ThermalState; source: "native_plugin" | "heuristic" }> {
  const plugin = getThermalPlugin();
  try {
    const result = await plugin.getThermalState();
    return { state: normalizeIosThermal(result.state), source: "native_plugin" };
  } catch {
    return { state: getThermalState(), source: "heuristic" };
  }
}

async function fetchNativeBattery(): Promise<{
  level: number;
  charging: boolean;
  source: "native_plugin" | "web_battery_api" | "default";
}> {
  const plugin = getBatteryPlugin();
  try {
    const info = await plugin.getBatteryInfo();
    if (info.batteryState !== "unknown") {
      return { level: info.batteryLevel, charging: info.isCharging, source: "native_plugin" };
    }
  } catch { /* plugin unavailable */ }

  // Web Battery API fallback
  const nav = navigator as Navigator & { getBattery?(): Promise<{ level: number; charging: boolean }> };
  if (nav.getBattery) {
    try {
      const bat = await nav.getBattery();
      return { level: Math.round(bat.level * 100), charging: bat.charging, source: "web_battery_api" };
    } catch { /* */ }
  }

  return { level: 100, charging: true, source: "default" };
}

// ── Main state assembly ───────────────────────────────────────────────────────

export async function sampleNativeThermalBattery(): Promise<NativeThermalBatteryState> {
  const [{ state: thermalState, source: thermalSource }, { level: batteryLevel, charging: isCharging, source: batterySource }] =
    await Promise.all([fetchNativeThermal(), fetchNativeBattery()]);

  const trend = getThermalTrend();
  const thermalEscalating = trend === "heating";
  const thermalRisk = RISK_BY_STATE[thermalState] ?? "low";
  const lowPowerMode = !isCharging && batteryLevel < 20;
  const chargingPolicy = deriveChargingPolicy(isCharging, batteryLevel, thermalState);
  const sustainedHeatRiskScore = computeSustainedHeatRisk(thermalState, thermalEscalating);

  const state: NativeThermalBatteryState = {
    thermalState, thermalSource, thermalRisk, thermalEscalating,
    batteryLevel, isCharging, lowPowerMode, batterySource,
    chargingPolicy, sustainedHeatRiskScore, sampledAt: Date.now(),
  };

  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch { /* */ }
  return state;
}

export function getNativeThermalBatteryState(): NativeThermalBatteryState {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as NativeThermalBatteryState | null;
    if (cached && Date.now() - cached.sampledAt < CACHE_TTL_MS) return cached;
  } catch { /* */ }

  // Return synchronous defaults (async sample needed for accuracy)
  const thermalState = getThermalState();
  return {
    thermalState, thermalSource: "heuristic",
    thermalRisk: RISK_BY_STATE[thermalState] ?? "low",
    thermalEscalating: getThermalTrend() === "heating",
    batteryLevel: 100, isCharging: true, lowPowerMode: false,
    batterySource: "default",
    chargingPolicy: { recommended: "balanced", reason: "not yet sampled", allowHeavySessions: true },
    sustainedHeatRiskScore: computeSustainedHeatRisk(thermalState, false),
    sampledAt: Date.now(),
  };
}

export function isDeviceInLowPowerMode(): boolean {
  return getNativeThermalBatteryState().lowPowerMode;
}
