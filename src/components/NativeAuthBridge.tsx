import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative, CAPACITOR_CALLBACK_URI } from "./providers/auth";

// Auth0 removes the login transaction after the first callback attempt. Keep
// callback de-duplication outside React so StrictMode remounts cannot consume
// one authorization response twice.
const handledCallbacks = new Set<string>();

function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const callback = new URL(CAPACITOR_CALLBACK_URI);

    return (
      parsed.protocol === callback.protocol &&
      parsed.host === callback.host &&
      parsed.pathname === callback.pathname &&
      parsed.searchParams.has("state") &&
      (parsed.searchParams.has("code") || parsed.searchParams.has("error"))
    );
  } catch {
    return false;
  }
}

export default function NativeAuthBridge({
  onProcessingChange,
  onError,
}: {
  onProcessingChange?: (processing: boolean) => void;
  onError?: (error: unknown) => void;
}) {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) return;

    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const processCallback = async (url: string) => {
      if (disposed || !isAuthCallbackUrl(url) || handledCallbacks.has(url)) return;

      handledCallbacks.add(url);
      onProcessingChange?.(true);

      try {
        await handleRedirectCallback(url);
      } catch (error) {
        console.error("[WellMate Auth] Native Auth0 callback failed:", error);
        onError?.(error);
      } finally {
        try {
          await Browser.close();
        } catch {
          // Android normally closes the Custom Tab automatically.
        }
        onProcessingChange?.(false);
      }
    };

    const setup = async () => {
      try {
        listenerHandle = await CapApp.addListener("appUrlOpen", ({ url }) => {
          void processCallback(url);
        });

        // The listener handles a live Activity. getLaunchUrl covers the case
        // where Android recreated the Activity before React mounted.
        const launch = await CapApp.getLaunchUrl();
        if (launch?.url) {
          await processCallback(launch.url);
        }
      } catch (error) {
        console.error("[WellMate Auth] Native Auth0 bridge setup failed:", error);
        onError?.(error);
      } finally {
        onProcessingChange?.(false);
      }
    };

    void setup();

    return () => {
      disposed = true;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [handleRedirectCallback, onError, onProcessingChange]);

  return null;
}
