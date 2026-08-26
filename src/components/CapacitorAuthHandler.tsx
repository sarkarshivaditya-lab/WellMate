import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative } from "./providers/authConfig";

function isAuth0Callback(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hasState = parsed.searchParams.has("state");
    const hasCodeOrError = parsed.searchParams.has("code") || parsed.searchParams.has("error");
    return hasState && hasCodeOrError;
  } catch {
    return false;
  }
}

export default function CapacitorAuthHandler() {
  const { handleRedirectCallback } = useAuth0();
  const handledCallbacks = useRef(new Set<string>());

  useEffect(() => {
    if (!isCapacitorNative) return;

    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;

    const handleCallback = async (url: string) => {
      if (disposed || !isAuth0Callback(url) || handledCallbacks.current.has(url)) return;
      handledCallbacks.current.add(url);

      try {
        await handleRedirectCallback(url);
      } catch (error) {
        handledCallbacks.current.delete(url);
        console.error(
          "[CapacitorAuthHandler] Auth0 callback failed",
          error instanceof Error ? error.message : "unknown error",
        );
      } finally {
        await Browser.close().catch(() => undefined);
      }
    };

    const setup = async () => {
      listener = await CapApp.addListener("appUrlOpen", ({ url }) => {
        void handleCallback(url);
      });

      const launchUrl = await CapApp.getLaunchUrl();
      if (launchUrl?.url) await handleCallback(launchUrl.url);

      if (disposed && listener) await listener.remove();
    };

    void setup();

    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, [handleRedirectCallback]);

  return null;
}
