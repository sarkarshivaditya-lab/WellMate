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
 * Handling both paths is important on Android; otherwise a successful Auth0
 * login can return to the app without ever reaching handleRedirectCallback,
 * leaving Auth0 isAuthenticated=false and sending the user back to login.
 */
export default function CapacitorAuthHandler() {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) return;

    let disposed = false;
    let handlingUrl = "";

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
      }
    };

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      listenerHandle = await CapApp.addListener("appUrlOpen", ({ url }) => {
        void handleCallbackUrl(url);
      });

      // Android may launch the activity directly from the Auth0 callback.
      // In that case appUrlOpen is not guaranteed to be emitted after this
      // React component mounts, so explicitly inspect the launch URL.
      const launch = await CapApp.getLaunchUrl();
      if (launch?.url) {
        void handleCallbackUrl(launch.url);
      }
    };

    void setup();

    return () => {
      disposed = true;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [handleRedirectCallback]);

  return null;
}
