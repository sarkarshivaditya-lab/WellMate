import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Heart, Sparkles, Send, Info } from "lucide-react";
import type { AiMentalResponse } from "@/services/aiMentalTypes";

/* ======================================================
   INTERNAL FALLBACK DETECTION (UX ONLY)
   ====================================================== */
function isFallbackResponse(response: AiMentalResponse): boolean {
  return (
    response.confidence === "low" &&
    (
      response.summary.toLowerCase().includes("setting") ||
      response.summary.toLowerCase().includes("configured") ||
      response.summary.toLowerCase().includes("try again")
    )
  );
}

/* ======================================================
   EMOTION CONFIG
   ====================================================== */
const emotionConfig = {
  calm: { color: "bg-green-100 text-green-800", emoji: "😌" },
  stressed: { color: "bg-orange-100 text-orange-800", emoji: "😰" },
  anxious: { color: "bg-yellow-100 text-yellow-800", emoji: "😟" },
  sad: { color: "bg-blue-100 text-blue-800", emoji: "😢" },
  content: { color: "bg-green-100 text-green-800", emoji: "😊" },
  frustrated: { color: "bg-red-100 text-red-800", emoji: "😤" },
  overwhelmed: { color: "bg-purple-100 text-purple-800", emoji: "😵" },
  hopeful: { color: "bg-teal-100 text-teal-800", emoji: "🌱" },
};

export default function AiMentalCoach() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<AiMentalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const askCoach = useAction(api.aiMentalCoach.askMentalCoach);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const result = await askCoach({ message: message.trim() });
      setResponse(result);
      setMessage("");
    } catch (error) {
      console.error("AI Mental Coach error:", error);

      // Investor-safe fallback copy
      setResponse({
        summary:
          "WellMate is getting ready to support you more deeply. Once enabled, I’ll be able to respond with more thoughtful and personalized guidance.",
        emotion: "calm",
        suggestions: [
          "You can still explore journaling and wellbeing tools",
          "Try sharing what’s on your mind later",
          "Remember this space is here for you",
        ],
        practice: {
          id: "p1",
          title: "Gentle Breathing",
          steps: [
            "Inhale slowly through your nose",
            "Exhale gently through your mouth",
            "Repeat for a few calm breaths",
          ],
        },
        escalation: false,
        confidence: "low",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const fallbackMode = response ? isFallbackResponse(response) : false;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">WellMate</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          A calm space for reflection and emotional wellbeing
        </p>
      </div>

      {/* Fallback / Setup Notice */}
      {fallbackMode && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="pt-6 text-sm flex gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-blue-900">
                WellMate is setting things up
              </p>
              <p className="text-muted-foreground">
                Advanced AI support will be enabled soon. This does not affect your data or progress.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What’s on your mind?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="You can say anything — even just ‘hi’."
            className="min-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                Thinking…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Get Support
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {/* NORMAL RESPONSE (NO CRISIS WHEN FALLBACK) */}
      {response && !response.escalation && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-lg">Reflection</CardTitle>
              <Badge className={emotionConfig[response.emotion].color}>
                {emotionConfig[response.emotion].emoji} {response.emotion}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{response.summary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gentle Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {response.suggestions.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* INITIAL PROMPTS */}
      {!response && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">You could start with:</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              "Hi",
              "I’m feeling a bit overwhelmed",
              "I just want to talk",
              "I had a long day",
              "I want to feel calmer",
            ].map((p) => (
              <button
                key={p}
                onClick={() => setMessage(p)}
                className="text-left text-sm p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                “{p}”
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
