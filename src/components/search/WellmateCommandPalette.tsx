// src/components/search/WellmateCommandPalette.tsx
// Calm command palette — universal search, navigation, and quick-add.
// Uses existing cmdk primitives from src/components/ui/command.tsx.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Brain,
  Repeat,
  Moon,
  User,
  LayoutGrid,
  UtensilsCrossed,
  Dumbbell,
  BookOpen,
  Heart,
  Smile,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { searchAll } from "@/search/searchIndex";
import type { SearchResult, SearchModule } from "@/search/searchTypes";
import { haptics } from "@/motion/haptics";
import { QuickAddSheet } from "@/components/quickadd/QuickAddSheet";
import { emitAnalyticsEvent } from "@/analytics/eventBus";

type QuickEntity = "mood" | "journal" | "exercise" | "sleep" | "meal" | "habit";
