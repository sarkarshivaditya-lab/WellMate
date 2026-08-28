import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative, CAPACITOR_CALLBACK_URI } from "./providers/auth";

/**
 * Bridges Auth0 Universal Login callbacks back into the Capacitor WebView.
 *
 * The callback can arrive in two ways:
 *  - appUrlOpen when the app is already running/backgrounded
 *  - getLaunchUrl when Android cold-starts the app from the callback URI
 *
 * The readiness callback is intentionally held until a cold-start callback has
 * been processed. This prevents RequireAuth from immediately starting a new
 * Auth0 login and overwriting the transaction before the returning callback
 * can be consumed.
 */
export default function CapacitorAuthHandler({ onReady }: { onReady?: () => void }) {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) {
      onReady?.();
      return;
    }

    let disposed = false;
    let handlingUrl = "";
    let readySignalled = false;

    const signalReady = () => {
      if (disposed || readySignalled) return;
      readySignalled = true;
      onReady?.();
    };

    const isAuthCallback = (url: string) => {
      return url.startsWith(CAPACITOR_CALLBACK_URI) &&
        (url.includes("code=") || url.includes("error="));
    };

    const handleCallbackUrl = async (url: string) => {
      if (disposed || !isAuthCallback(url) || handlingUrl === url) return;
      handlingUrl = url;

      try {
        await handleRedirectCallback(url);
      } catch (err) {
        console.error("[CapacitorAuthHandler] Auth0 callback handling failed:", err);
      } finally {
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed when Android cold-started the app.
        }
        signalReady();
      }
    };

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      listenerHandle = await CapApp.addListener("appUrlOpen", ({ url }) => {
        void handleCallbackUrl(url);
      });

      const launch = await CapApp.getLaunchUrl();
      if (launch?.url && isAuthCallback(launch.url)) {
        // Do not release the auth gate until the callback has been consumed.
        await handleCallbackUrl(launch.url);
        return;
      }

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
