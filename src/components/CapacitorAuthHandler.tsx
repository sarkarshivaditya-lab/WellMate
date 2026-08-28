import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative } from "./providers/auth";

/**
 * Single native Auth0 callback boundary.
 *
 * Auth0's Ionic/Capacitor flow delivers the callback through the appUrlOpen
 * event. Android can also relaunch a cold app with the callback as its launch
 * URL, so getLaunchUrl is handled as a fallback. A ref-backed lock survives
 * React StrictMode effect re-runs and prevents the one-time PKCE transaction
 * from being consumed twice.
 */
export default function CapacitorAuthHandler({
  onReady,
  onError,
}: {
  onReady?: () => void;
  onError?: (error: unknown) => void;
}) {
  const { handleRedirectCallback } = useAuth0();
  const handledUrls = useRef(new Set<string>());
  const inFlightUrls = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    if (!isCapacitorNative) {
      onReady?.();
      return;
    }

    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const isAuthCallback = (url: string) => {
      try {
        const parsed = new URL(url);
        return (
          Boolean(parsed.searchParams.get("state")) &&
          (Boolean(parsed.searchParams.get("code")) || Boolean(parsed.searchParams.get("error")))
        );
      } catch {
        return false;
      }
    };

    const handleCallbackUrl = async (url: string): Promise<void> => {
      if (disposed || !isAuthCallback(url)) return;
      if (handledUrls.current.has(url)) return;

      const existing = inFlightUrls.current.get(url);
      if (existing) return existing;

      const work = (async () => {
        if (disposed || handledUrls.current.has(url)) return;
        handledUrls.current.add(url);

        try {
          await handleRedirectCallback(url);
        } catch (error) {
          console.error("[CapacitorAuthHandler] Auth0 callback handling failed:", error);
          handledUrls.current.delete(url);
          onError?.(error);
        } finally {
          inFlightUrls.current.delete(url);
          try {
            await Browser.close();
          } catch {
            // Android normally closes the Custom Tab itself.
          }
          onReady?.();
        }
      })();

      inFlightUrls.current.set(url, work);
      return work;
    };

    const setup = async () => {
      try {
        listenerHandle = await CapApp.addListener("appUrlOpen", ({ url }) => {
          void handleCallbackUrl(url);
        });

        // The listener is registered before checking the launch intent so a
        // callback arriving during app startup cannot be missed.
        const launch = await CapApp.getLaunchUrl();
        if (launch?.url) {
          await handleCallbackUrl(launch.url);
        }
      } catch (error) {
        console.error("[CapacitorAuthHandler] Failed to initialize callback handler:", error);
        onError?.(error);
      } finally {
        onReady?.();
      }
    };

    void setup();

    return () => {
      disposed = true;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [handleRedirectCallback, onError, onReady]);

  return null;
}
