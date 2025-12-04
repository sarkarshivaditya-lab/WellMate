import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import RootRedirect from "./pages/RootRedirect.tsx";
import RootStaticPreview from "./pages/RootStaticPreview.tsx";
import DevPreview from "./pages/DevPreview.tsx";
import Index from "./pages/Index.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Dev from "./pages/Dev.tsx";
import Habits from "./pages/Habits.tsx";
import Sleep from "./pages/Sleep.tsx";
import Pricing from "./pages/Pricing.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  // Show static preview immediately if on root path (for Hercules preview)
  if (window.location.pathname === "/" && !window.location.search) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootStaticPreview />} />
          <Route path="*" element={<RootStaticPreview />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootStaticPreview />} />
          <Route path="/dev-preview" element={<DevPreview />} />
          <Route path="/physical" element={<Index />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dev" element={<Dev />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
