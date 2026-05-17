// src/notifications/hooks/useNotifications.ts

import { useState, useCallback } from "react";
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  setCategoryEnabled,
} from "../preferences";
import { getFatigueState, resetFatigue } from "../fatigue";
import { getQueue, clearHistory } from "../queue";
import { isInQuietHours } from "../quietHours";
import { forceEvaluate } from "../engine";
import type { NotificationCategory, NotificationPreferences } from "../types";

export function useNotifications() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    getNotificationPreferences(),
  );

  const refresh = useCallback(() => {
    setPrefs(getNotificationPreferences());
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      patchNotificationPreferences({ enabled });
      refresh();
    },
    [refresh],
  );

  const toggleCategory = useCallback(
    (category: NotificationCategory, enabled: boolean) => {
      setCategoryEnabled(category, enabled);
      refresh();
    },
    [refresh],
  );

  const setDailyCap = useCallback(
    (cap: number) => {
      patchNotificationPreferences({ dailyCap: cap });
      refresh();
    },
    [refresh],
  );

  const setSensitivity = useCallback(
    (level: "low" | "normal" | "high") => {
      patchNotificationPreferences({ sensitivityLevel: level });
      refresh();
    },
    [refresh],
  );

  return {
    prefs,
    inQuietHours: isInQuietHours(prefs),
    queueLength: getQueue().length,
    fatigueState: getFatigueState(),
    setEnabled,
    toggleCategory,
    setDailyCap,
    setSensitivity,
    resetFatigue,
    clearHistory,
    forceEvaluate,
  };
}
