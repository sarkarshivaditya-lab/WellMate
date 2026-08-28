"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FREE_MODEL = "openrouter/free";

export const chat = action({
  args: {
    system: v.optional(v.string()),
    message: v.string(),
    maxTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ConvexError("OPENROUTER_API_KEY_MISSING");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://wellmate-website.vercel.app",
          "X-Title": "WellMate",
        },
        body: JSON.stringify({
          model: FREE_MODEL,
          messages: [
            ...(args.system
              ? [{ role: "system", content: args.system }]
              : []),
            { role: "user", content: args.message },
          ],
          max_tokens: Math.min(args.maxTokens ?? 700, 900),
          temperature: args.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new ConvexError(
          "OPENROUTER_HTTP_" +
            response.status +
            (detail ? ": " + detail.slice(0, 180) : ""),
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new ConvexError("OPENROUTER_EMPTY_RESPONSE");

      return { content, model: data.model ?? FREE_MODEL };
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConvexError("OPENROUTER_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
