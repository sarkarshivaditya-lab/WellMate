import * as React from "react";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function WellMateLauncher() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "m1",
      role: "assistant",
      text: "Hi, I’m WellMate 👋",
    },
    {
      id: "m2",
      role: "assistant",
      text: "I’ll help you with fitness, nutrition, and wellbeing.",
    },
    {
      id: "m3",
      role: "assistant",
      text: "Ask me anything to get started.",
    },
  ]);
  const [thinking, setThinking] = React.useState(false);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close on outside click
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

  // Focus input on open
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, open]);

  function send() {
    if (!input.trim() || thinking) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim(),
    };

    setMessages((m) => [...m, userMessage]);
    setInput("");
    setThinking(true);

    // UI-only canned response
    setTimeout(() => {
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text:
          "I’m still learning — but soon I’ll be able to give you personalized guidance here.",
      };
      setMessages((m) => [...m, reply]);
      setThinking(false);
    }, 700);
  }

  return (
    <>
      {/* Floating launcher button */}
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
            "w-80",
            "rounded-xl border bg-card text-card-foreground",
            "shadow-lg",
            "flex flex-col",
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">WellMate</p>
            <p className="text-xs text-muted-foreground">
              Your health companion
            </p>
          </div>

          {/* Transcript */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
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
                    "rounded-lg px-3 py-2 max-w-[85%]",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-muted text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Composer */}
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
