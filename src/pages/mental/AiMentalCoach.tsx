import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Heart, Sparkles, Send } from "lucide-react";
import type { AiMentalResponse } from "@/services/aiMentalTypes";

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
      setResponse({
        summary: "I'm having trouble connecting right now. Please try again in a moment.",
        emotion: "calm",
        suggestions: ["Take a few deep breaths", "Try again in a moment"],
        practice: {
          id: "p1",
          title: "Box Breathing",
          steps: ["Inhale for 4 seconds", "Hold for 4 seconds", "Exhale for 4 seconds", "Hold for 4 seconds"],
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

  return (
    <div className="space-y-6 p-4 pb-24">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">AI Mental Wellbeing Coach</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Share how you're feeling and get personalized wellness support
        </p>
      </div>

      {/* Important Notice */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="pt-6 text-sm space-y-3">
          <div>
            <p className="font-medium mb-2">This is wellness support, not therapy</p>
            <p className="text-muted-foreground">
              Our AI provides general wellbeing guidance based on your mood and journal entries. 
              For professional mental health support, please contact a licensed therapist or counselor.
            </p>
          </div>
          <div className="pt-2 border-t border-amber-500/20">
            <p className="font-medium mb-1">Setup Required</p>
            <p className="text-muted-foreground text-xs">
              To use the AI Mental Coach, add your <code className="bg-amber-500/10 px-1 py-0.5 rounded">OPENAI_API_KEY</code> in More → Secrets. 
              Get a key from platform.openai.com/api-keys
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What's on your mind?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share how you're feeling, what's challenging you, or what you'd like support with..."
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
                Thinking...
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

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Response - Escalation (Crisis) */}
      {response && response.escalation && (
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <CardTitle className="text-lg text-red-900">Important: Immediate Support Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-red-900">
            <p className="font-medium">
              It sounds like you may be going through a difficult time. Please reach out for professional support right away.
            </p>
            
            <div className="bg-white p-4 rounded-lg space-y-3">
              <p className="font-semibold">Crisis Resources:</p>
              <div className="space-y-2 text-sm">
                <p><strong>988 Suicide & Crisis Lifeline:</strong> Call or text 988 (US)</p>
                <p><strong>Crisis Text Line:</strong> Text HOME to 741741</p>
                <p><strong>International:</strong> findahelpline.com</p>
                <p><strong>Emergency:</strong> Call 911 or go to nearest emergency room</p>
              </div>
            </div>

            <p className="text-sm">
              You deserve support. These trained professionals are available 24/7 and want to help.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Response - Normal Wellness Support */}
      {response && !response.escalation && (
        <div className="space-y-4">
          {/* Emotional Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">How You're Feeling</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{emotionConfig[response.emotion].emoji}</span>
                  <Badge className={emotionConfig[response.emotion].color}>
                    {response.emotion}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{response.summary}</p>
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supportive Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {response.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Recommended Practice */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Recommended Practice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3">{response.practice.title}</h3>
                <div className="space-y-2">
                  {response.practice.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">{index + 1}</span>
                      </div>
                      <p className="text-sm flex-1">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 border-t text-xs text-muted-foreground">
                <p>Tip: Visit the Tools tab to explore all {response.practice.steps.length}+ wellbeing practices</p>
              </div>
            </CardContent>
          </Card>

          {/* Confidence & Disclaimer */}
          <Card className="bg-secondary/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <div className="flex-1 space-y-1">
                  <p>
                    <strong>AI Confidence:</strong> {response.confidence}
                  </p>
                  <p>
                    This guidance is based on your recent mood and journal data. Remember, this is general 
                    wellness support and not a substitute for professional mental health care.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Initial Prompt Ideas */}
      {!response && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not sure what to share? Try:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {[
                "I'm feeling stressed about work lately",
                "I've been having trouble sleeping",
                "I want to be more mindful and present",
                "I'm feeling overwhelmed by everything",
                "I need help managing anxiety",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setMessage(prompt)}
                  className="text-left text-sm p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
