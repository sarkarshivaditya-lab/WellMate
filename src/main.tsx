import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

// auth0 domain intentionally not logged in production

export function Root() {
  return (
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <DefaultProviders>
            <App />
          </DefaultProviders>
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
