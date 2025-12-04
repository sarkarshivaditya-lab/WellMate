/**
 * Adapter Factory
 * 
 * Exports the correct server adapter based on DEV_MODE environment variable.
 * 
 * DEV_MODE=true  → MockServerAdapter (local development)
 * DEV_MODE=false → HttpServerAdapter (production with real backend)
 */

import type { IServerAdapter } from "./serverAdapter.interface";
import { MockServerAdapter } from "./mockServerAdapter";
import { HttpServerAdapter } from "./httpServerAdapter";

// Read DEV_MODE from environment
const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

// Create singleton instance
let adapterInstance: IServerAdapter;

if (DEV_MODE) {
  console.log("[Adapter] Using MockServerAdapter (DEV_MODE=true)");
  adapterInstance = new MockServerAdapter();
} else {
  console.log("[Adapter] Using HttpServerAdapter (DEV_MODE=false)");
  adapterInstance = new HttpServerAdapter();
}

/**
 * Singleton server adapter instance
 * 
 * Import this in components/actions to communicate with backend:
 * 
 * ```ts
 * import { serverAdapter } from "@/adapters/adapterFactory";
 * 
 * const response = await serverAdapter.postAiPhysical(profile, message);
 * ```
 */
export const serverAdapter = adapterInstance;

/**
 * Check if running in dev mode
 */
export const isDevMode = (): boolean => DEV_MODE;
