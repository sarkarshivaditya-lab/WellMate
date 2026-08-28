import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isCapacitorNative } from "./providers/auth";

const CALLBACK_PREFIX = "com.wellmate.app://callback";

export default function CapacitorAuthHandler() {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    if (!isCapacitorNative) return;

    let disposed = false;
    let processing = false;
    let listener: { remove: () => Promise<void> } | null = null;

    const processCallback = async (url: string) => {
      if (!url.startsWith(CALLBACK_PREFIX) || disposed || processing) return;

      processing = true;
      try {
        await handleRedirectCallback(url);
      } catch (error) {
        console.error("[Auth] native callback handling failed", error);
      } finally {
        processing = false;
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed.
        }
      }
    };

    const setup = async () => {
      listener = await CapApp.addListener("appUrlOpen", ({ url }) => {
        void processCallback(url);
      });

      if (disposed) {
        await listener.remove();
        listener = null;
        return;
      }

      try {
        const launch = await CapApp.getLaunchUrl();
        if (launch?.url) {
          await processCallback(launch.url);
        }
      } catch (error) {
        console.error("[Auth] native launch URL inspection failed", error);
      }
    };

    void setup();

    return () => {
      disposed = true;
      if (listener) {
        void listener.remove();
        listener = null;
      }
    };
  }, [handleRedirectCallback]);

  return null;
}
