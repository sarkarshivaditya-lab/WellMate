import React, { createContext, useState, useCallback } from "react";

export type CommandPaletteContextValue = {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
};

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

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
