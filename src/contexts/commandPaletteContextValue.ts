import { createContext } from "react";

export type CommandPaletteContextValue = {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
};

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);
