import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative } from "./providers/auth";

/**
 * Listens for the Auth0 callback URL when running inside Capacitor Android/iOS.
 *
 * Flow:
 *   1. RequireAuth opens Auth0 Universal Login in the system browser via Browser.open().
 *   2. Auth0 redirects to com.wellmate.app://callback?code=...&state=...
 *   3. Android routes that URI back to MainActivity via the intent-filter.
 *   4. Capacitor fires the appUrlOpen event here.
 *   5. We call handleRedirectCallback(url) to exchange the code for tokens.
 *   6. We close the system browser — user is now authenticated inside the app.
 *
 * This component renders nothing; mount it once inside App.
 */
export default function CapacitorAuthHandler() {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) return;

    let removed = false;

    const setup = async () => {
      const listener = await CapApp.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith("com.wellmate.app://")) return;
        try {
          await handleRedirectCallback(url);
        } catch (err) {
          console.error("[CapacitorAuthHandler] handleRedirectCallback failed:", err);
        } finally {
          await Browser.close();
        }
      });

      if (removed) {
        listener.remove();
      }
    };

    setup();

    return () => {
      removed = true;
    };
  }, [handleRedirectCallback]);

  return null;
}
