import { useContext } from "react";
import { CommandPaletteContext } from "@/contexts/commandPaletteContext";

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be within CommandPaletteProvider");
  return ctx;
}
