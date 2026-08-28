import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative, CAPACITOR_CALLBACK_URI } from "./providers/auth";

/**
 * Owns the native Auth0 callback boundary.
 *
 * Android can deliver a custom-scheme callback either while the app is already
 * alive (`appUrlOpen`) or as the URL that launched a cold app (`getLaunchUrl`).
 * Both paths feed the same de-duplicated handler so Auth0's one-time PKCE
 * transaction is never consumed twice and is never lost on cold start.
 */
export default function CapacitorAuthHandler({
  onReady,
  onError,
}: {
  onReady?: () => void;
  onError?: (error: unknown) => void;
}) {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) {
      onReady?.();
      return;
    }

    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    const handledCallbacks = new Set<string>();

    const isAuthCallback = (url: string) => {
      try {
        const parsed = new URL(url);
        const callback = new URL(CAPACITOR_CALLBACK_URI);
        return (
          parsed.protocol === callback.protocol &&
          parsed.host === callback.host &&
          parsed.pathname === callback.pathname &&
          (parsed.searchParams.has("code") || parsed.searchParams.has("error")) &&
          parsed.searchParams.has("state")
        );
      } catch {
        return false;
      }
    };

    const handleCallbackUrl = async (url: string) => {
      if (disposed || !isAuthCallback(url) || handledCallbacks.has(url)) return;
      handledCallbacks.add(url);

      try {
        await handleRedirectCallback(url);
      } catch (error) {
        console.error("[CapacitorAuthHandler] Auth0 callback handling failed:", error);
        onError?.(error);
      } finally {
        try {
          await Browser.close();
        } catch {
          // Android may already have closed the browser surface.
        }
        onReady?.();
      }
    };

    const setup = async () => {
      listenerHandle = await CapApp.addListener("appUrlOpen", ({ url }) => {
        void handleCallbackUrl(url);
      });

      // Register the live listener first, then inspect the launch intent. This
      // covers Android cold-start callbacks without missing an already-delivered
      // intent, while the Set above prevents duplicate callback consumption.
      try {
        const launch = await CapApp.getLaunchUrl();
        if (launch?.url) {
          await handleCallbackUrl(launch.url);
        }
      } catch (error) {
        console.error("[CapacitorAuthHandler] Failed to inspect launch URL:", error);
      }

      onReady?.();
    };

    void setup();

    return () => {
      disposed = true;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [handleRedirectCallback, onError, onReady]);

  return null;
}
