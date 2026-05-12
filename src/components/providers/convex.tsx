import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import type { ReactNode } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

/**
 * Convex client singleton.
 * If VITE_CONVEX_URL is missing or invalid (e.g. CI build without secrets),
 * we create the client anyway — it will fail to connect but will not crash
 * the module. All Convex queries/mutations will remain in a loading/error
 * state; the app continues to work from localStorage (offline-first).
 */
let convex: ConvexReactClient;
try {
  // Use a non-localhost URL in production if env var is absent.
  // An empty-string URL would throw; fall through to catch below.
  const url = convexUrl ?? "";
  if (!url) throw new Error("no url");
  convex = new ConvexReactClient(url);
} catch {
  if (!convexUrl) {
    console.warn(
      "[ConvexProvider] VITE_CONVEX_URL is not set. " +
        "Convex will be unavailable — app runs in offline/local mode."
    );
  } else {
    console.warn("[ConvexProvider] Failed to initialise Convex client:", convexUrl);
  }
  // Create a client pointing to a placeholder — it will not connect but will
  // not throw synchronously, keeping the React tree intact.
  convex = new ConvexReactClient("https://placeholder.convex.cloud");
}

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth0 client={convex}>
      {children}
    </ConvexProviderWithAuth0>
  );
}
