/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiCoach from "../aiCoach.js";
import type * as aiMentalCoach from "../aiMentalCoach.js";
import type * as cycles from "../cycles.js";
import type * as exercises from "../exercises.js";
import type * as habits from "../habits.js";
import type * as insights from "../insights.js";
import type * as journal from "../journal.js";
import type * as meals from "../meals.js";
import type * as moods from "../moods.js";
import type * as sleep from "../sleep.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiCoach: typeof aiCoach;
  aiMentalCoach: typeof aiMentalCoach;
  cycles: typeof cycles;
  exercises: typeof exercises;
  habits: typeof habits;
  insights: typeof insights;
  journal: typeof journal;
  meals: typeof meals;
  moods: typeof moods;
  sleep: typeof sleep;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
