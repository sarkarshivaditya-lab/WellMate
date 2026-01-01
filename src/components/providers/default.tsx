import React from "react";
import { AuthProvider } from "./auth";
import { ConvexProvider } from "./convex";
import { QueryClientProvider } from "./query-client";
import { ThemeProvider } from "./theme";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";

export function DefaultProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ConvexProvider>
        <QueryClientProvider>
          <TooltipProvider>
            <ThemeProvider>
              <Toaster />
              {children}
            </ThemeProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </AuthProvider>
  );
}
