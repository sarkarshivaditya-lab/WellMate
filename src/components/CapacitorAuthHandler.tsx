import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative, CAPACITOR_CALLBACK_URI } from "./providers/auth";

/**
 * Handles the single Auth0 redirect callback emitted by Capacitor.
 *
 * Auth0's Ionic/Capacitor React quickstart uses the appUrlOpen event as the
 * native callback boundary. We intentionally do not also consume getLaunchUrl
 * here: on Android a cold-start callback can be observable through both paths,
 * and Auth0's transaction is single-use. Calling handleRedirectCallback twice
 * produces an invalid/missing transaction and leaves the app unauthenticated.
 */
export default function CapacitorAuthHandler({ onReady }: { onReady?: () => void }) {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) {
      onReady?.();
      return;
    }

    let disposed = false;
    let readySignalled = false;
    const handledCallbacks = new Set<string>();

    const signalReady = () => {
      if (disposed || readySignalled) return;
      readySignalled = true;
      onReady?.();
    };

    const isAuthCallback = (url: string) => {
      try {
        const parsed = new URL(url);
        const callback = new URL(CAPACITOR_CALLBACK_URI);
        return parsed.protocol === callback.protocol &&
          parsed.host === callback.host &&
          parsed.pathname === callback.pathname &&
          (parsed.searchParams.has("code") || parsed.searchParams.has("error"));
      } catch {
        return false;
      }
    };

    const handleCallbackUrl = async (url: string) => {
      if (disposed || !isAuthCallback(url) || handledCallbacks.has(url)) return;
      handledCallbacks.add(url);

      try {
        await handleRedirectCallback(url);
      } catch (err) {
        console.error("[CapacitorAuthHandler] Auth0 callback handling failed:", err);
      } finally {
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed when Android delivered the callback.
        }
        signalReady();
      }
    };

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      listenerHandle = await CapApp.addListener("appUrlOpen", ({ url }) => {
        void handleCallbackUrl(url);
      });

      // Match Auth0's official Capacitor flow: the appUrlOpen event is the
      // callback boundary. There is no second callback consumption path.
      signalReady();
    };

    void setup();

    return () => {
      disposed = true;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [handleRedirectCallback, onReady]);

  return null;
}
