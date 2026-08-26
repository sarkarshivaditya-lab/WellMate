import React, { useContext, useState, useCallback } from "react";
import { CommandPaletteContext } from "./commandPaletteContextValue";

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  return (
    <CommandPaletteContext.Provider value={{ open, openPalette, closePalette }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be within CommandPaletteProvider");
  return ctx;
}
