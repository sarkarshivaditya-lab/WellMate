import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DefaultProviders } from "./components/providers/default";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

// auth0 domain intentionally not logged in production

export function Root() {
  const [, forceRender] = React.useState(0);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        forceRender((v) => v + 1);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <React.StrictMode>
      <AppErrorBoundary>
        <DefaultProviders>
          <App />
        </DefaultProviders>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
