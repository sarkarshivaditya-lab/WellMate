import * as React from "react";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ClarifyPayload = {
  question: string;
  options?: string[];
};

function WellMateLauncher() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    { id: "m1", role: "assistant", text: "Hi, I’m WellMate 👋" },
    {
      id: "m2",
      role: "assistant",
      text: "I’ll help you with fitness, nutrition, and wellbeing.",
    },
    { id: "m3", role: "assistant", text: "Ask me anything to get started." },
  ]);
  const [thinking, setThinking] = React.useState(false);
  const [clarify, setClarify] = React.useState<ClarifyPayload | null>(null);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const wellmateChat = useAction(api.wellmateChat.chat);

  function safeString(payload: unknown, field: string): string | null {
    if (!payload || typeof payload !== "object") return null;
    const v = (payload as Record<string, unknown>)[field];
    return typeof v === "string" ? v : null;
  }

  function safeNumber(payload: unknown, field: string): number | null {
    if (!payload || typeof payload !== "object") return null;
    const v = (payload as Record<string, unknown>)[field];
    return typeof v === "number" ? v : null;
  }

  function safeNutrition(payload: unknown) {
    if (!payload || typeof payload !== "object") return null;
    const n = (payload as Record<string, unknown>).nutrition;
    if (!n || typeof n !== "object") return null;
    return {
      calories: safeNumber(n, "calories"),
      protein: safeNumber(n, "protein_g"),
      carbs: safeNumber(n, "carbs_g"),
      fat: safeNumber(n, "fat_g"),
    };
  }

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, clarify, open]);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleSend(text: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setMessages((m) => [...m, userMessage]);
    setThinking(true);
    setClarify(null);

    try {
      const res = await wellmateChat({ message: text });

      if (res.domain === "clarify") {
        const payload = res.payload as ClarifyPayload;
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: payload.question,
          },
        ]);
        setClarify(payload);
      }

      if (res.domain === "mental") {
        const summary = safeString(res.payload, "summary");
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: summary ?? "I’m here with you.",
          },
        ]);
      }

      if (res.domain === "physical") {
        const advice = safeString(res.payload, "advice_text");
        const nutrition = safeNutrition(res.payload);
        const confidence = safeString(res.payload, "confidence");

        const lines: string[] = [];
        if (advice) lines.push(advice);
        if (nutrition?.calories != null) {
          lines.push(`Calories: ${nutrition.calories} kcal`);
        }
        if (
          nutrition?.protein != null &&
          nutrition?.carbs != null &&
          nutrition?.fat != null
        ) {
          lines.push(
            `Macros → Protein ${nutrition.protein}g · Carbs ${nutrition.carbs}g · Fat ${nutrition.fat}g`,
          );
        }
        if (confidence) lines.push(`Confidence: ${confidence}`);

        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: lines.join("\n"),
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  function send() {
    if (!input.trim() || thinking) return;
    const text = input.trim();
    setInput("");
    handleSend(text);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open WellMate"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-50 right-4",
          "bottom-[calc(env(safe-area-inset-bottom)+56px+12px)]",
          "h-11 w-11 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-md",
          "flex items-center justify-center",
          "text-sm font-medium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        WM
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="WellMate"
          className={cn(
            "fixed z-50 right-4",
            "bottom-[calc(env(safe-area-inset-bottom)+56px+64px)]",
            "w-80 max-w-[calc(100vw-2rem)]",
            "max-h-[60dvh]",
            "rounded-xl border bg-card text-card-foreground",
            "shadow-lg",
            "flex flex-col",
          )}
        >
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">WellMate</p>
            <p className="text-xs text-muted-foreground">
              Your health companion
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-3 space-y-3 text-sm">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-line",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {clarify && clarify.options && (
              <div className="flex flex-wrap gap-2">
                {clarify.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSend(opt)}
                    className="rounded-md border px-3 py-1 text-sm bg-background hover:bg-muted"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-muted text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t px-3 py-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask WellMate…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              className={cn(
                "flex-1 rounded-md border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || thinking}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                !input.trim() || thinking
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export { WellMateLauncher };
