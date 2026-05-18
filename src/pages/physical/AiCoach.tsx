import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Loader2Icon, SparklesIcon, AlertTriangleIcon } from "lucide-react";
import type { AiResponse } from "@/services/aiTypes.ts";
import { haptics } from "@/motion";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ai?: AiResponse;
};

export default function AiCoach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chat = useAction(api.aiCoach.chat);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    haptics.light();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await chat({ message: input });
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: response.advice_text,
        ai: response as AiResponse,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "Something went wrong on our end — give it a moment and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <CardTitle>AI Wellness Coach</CardTitle>
          </div>
          <CardDescription>
            Ask about meals, movement, or nutrition — WellMate will do its best.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[500px] pr-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <SparklesIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">Start a conversation</p>
                <p className="text-sm">
                  Try: "What should I eat this week?" or "Suggest a gentle workout to start with"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    {message.role === "user" ? (
                      <div className="flex justify-end mb-4">
                        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
                          {message.text}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start mb-4">
                        <div className="bg-muted rounded-lg p-4 max-w-[90%] space-y-4">
                          <p className="text-sm">{message.text}</p>

                          {message.ai && (
                            <>
                              {message.ai.escalation && (
                                <div className="bg-destructive/10 text-destructive rounded-lg p-3 flex items-start gap-2">
                                  <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                  <div className="text-sm">
                                    <strong>Important:</strong> Please consult a healthcare professional
                                  </div>
                                </div>
                              )}

                              <Card className="border-primary/20">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Your Nutrition Targets</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <div className="text-muted-foreground">Calories</div>
                                    <div className="font-semibold">{message.ai.nutrition.calories}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Protein</div>
                                    <div className="font-semibold">{message.ai.nutrition.protein_g}g</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Fat</div>
                                    <div className="font-semibold">{message.ai.nutrition.fat_g}g</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Carbs</div>
                                    <div className="font-semibold">{message.ai.nutrition.carbs_g}g</div>
                                  </div>
                                </CardContent>
                              </Card>

                              {message.ai.plan && message.ai.plan.length > 0 && (
                                <Card className="border-primary/20">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Suggested Plan</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {message.ai.plan.slice(0, 3).map((day) => (
                                      <div key={day.day} className="space-y-2">
                                        <div className="font-semibold text-sm">Day {day.day}</div>
                                        {day.workout && day.workout.length > 0 && (
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Workouts:</div>
                                            {day.workout.map((w, i) => (
                                              <div key={i} className="text-sm pl-2">
                                                • {w.name}
                                                {w.sets && ` (${w.sets}x${w.reps || ""})`}
                                                {w.duration_min && ` - ${w.duration_min} min`}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {day.meals && day.meals.length > 0 && (
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Meals:</div>
                                            {day.meals.map((m, i) => (
                                              <div key={i} className="text-sm pl-2">
                                                • {m.name}
                                                {m.calories && ` - ${m.calories} cal`}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {message.ai.plan.length > 3 && (
                                      <div className="text-xs text-muted-foreground">
                                        + {message.ai.plan.length - 3} more days
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}

                              <div className="text-xs space-y-1">
                                <div className="font-medium">Why this works:</div>
                                <div className="text-muted-foreground whitespace-pre-wrap">
                                  {message.ai.explainability}
                                </div>
                                <div className="text-muted-foreground">
                                  Confidence: {message.ai.confidence}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              placeholder="Ask for meal plans, workouts, or advice..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={loading}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
