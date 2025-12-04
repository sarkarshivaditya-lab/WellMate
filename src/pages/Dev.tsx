import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import practicesData from "@/data/practices.json";

export default function Dev() {
  const user = useQuery(api.users.getCurrentUser);
  const meals = useQuery(api.meals.getRecentMeals, { days: 30 });
  const moods = useQuery(api.moods.listMoods, { limit: 30 });
  const journalEntries = useQuery(api.journal.listJournalEntries, { limit: 30 });
  const generateInsights = useAction(api.insights.generateWeeklyInsights);
  
  const [adapterMode, setAdapterMode] = useState<"mock" | "api">("mock");
  const [insights, setInsights] = useState<{
    moodAverage: number;
    stressIndicators: string[];
    notes: string;
  } | null>(null);
  
  const handleExportMeals = () => {
    if (!meals || meals.length === 0) {
      toast.error("No meals to export");
      return;
    }
    const csv = [
      "Date,Name,Input Mode,Calories,Protein(g),Fat(g),Carbs(g)",
      ...meals.map((meal: {
        dateIso: string;
        name: string;
        inputMode: string;
        totalCalories: number;
        totalProteinG: number;
        totalFatG: number;
        totalCarbsG: number;
      }) =>
        [
          meal.dateIso,
          meal.name,
          meal.inputMode,
          meal.totalCalories,
          meal.totalProteinG,
          meal.totalFatG,
          meal.totalCarbsG,
        ].join(",")
      ),
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wellmate-meals-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Meals exported to CSV");
  };
  
  const handleToggleAdapter = () => {
    const newMode = adapterMode === "mock" ? "api" : "mock";
    setAdapterMode(newMode);
    toast.info(`Switched to ${newMode} adapter mode`);
  };
  
  const handleSeedPractices = () => {
    toast.success(`${practicesData.length} wellbeing practices are loaded from /src/data/practices.json`);
  };
  
  const handleDebugInsights = async () => {
    try {
      const result = await generateInsights({});
      setInsights(result);
      toast.success("Insights generated successfully");
    } catch (error) {
      toast.error("Failed to generate insights");
    }
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Developer Tools</h1>
          <p className="text-muted-foreground">Debugging and testing utilities</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>User Info</CardTitle>
            <CardDescription>Current user details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>Name: {user?.name || "N/A"}</div>
            <div>Email: {user?.email || "N/A"}</div>
            <div>Onboarding Complete: {user?.hasCompletedOnboarding ? "Yes" : "No"}</div>
            {user?.weightKg && <div>Weight: {user.weightKg} kg</div>}
            {user?.heightCm && <div>Height: {user.heightCm} cm</div>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Food Adapter</CardTitle>
            <CardDescription>Switch between mock and API adapters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Current Mode: <span className="text-primary">{adapterMode}</span></div>
              <Button onClick={handleToggleAdapter}>
                Toggle Adapter Mode
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Note: API adapter requires VITE_NUT_PROVIDER and VITE_NUT_API_KEY environment variables. Currently defaults to mock.
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>Export your data for backup or analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={handleExportMeals}>
              Export Meals to CSV
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Mental Wellbeing Tools</CardTitle>
            <CardDescription>Debug mental health features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button onClick={handleSeedPractices} variant="outline" className="w-full">
                Verify Wellbeing Practices
              </Button>
              <Button onClick={handleDebugInsights} className="w-full">
                Generate Weekly Insights
              </Button>
            </div>
            
            {insights && (
              <div className="mt-4 p-4 bg-secondary rounded-lg space-y-2 text-sm">
                <div className="font-semibold">Insights Output:</div>
                <div>Mood Average: {insights.moodAverage}/5</div>
                <div>Stress Indicators:</div>
                <ul className="list-disc list-inside ml-2">
                  {insights.stressIndicators.map((indicator: string, i: number) => (
                    <li key={i}>{indicator}</li>
                  ))}
                </ul>
                <div className="pt-2 border-t">Notes: {insights.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Mental Coach Context</CardTitle>
            <CardDescription>View data sent to AI Mental Coach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div>
                <div className="font-semibold mb-1">Recent Moods:</div>
                {moods && moods.length > 0 ? (
                  <div className="p-3 bg-secondary/50 rounded font-mono text-xs">
                    {moods.slice(0, 7).map((mood, i) => (
                      <div key={i}>
                        {new Date(mood.dateIso).toLocaleDateString()}: {mood.moodValue}/5
                        {mood.note && ` - "${mood.note}"`}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No mood data yet</p>
                )}
              </div>
              
              <div>
                <div className="font-semibold mb-1">Recent Journal Entries:</div>
                {journalEntries && journalEntries.length > 0 ? (
                  <div className="p-3 bg-secondary/50 rounded font-mono text-xs space-y-2">
                    {journalEntries.slice(0, 3).map((entry, i) => (
                      <div key={i}>
                        <div className="font-semibold">{new Date(entry.dateIso).toLocaleDateString()}</div>
                        <div className="text-muted-foreground line-clamp-2">{entry.text}</div>
                        {entry.tags.length > 0 && (
                          <div className="text-xs">Tags: {entry.tags.join(", ")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No journal entries yet</p>
                )}
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground pt-2 border-t">
              This is the context data that gets sent to the AI Mental Coach to personalize responses.
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Database Stats</CardTitle>
            <CardDescription>Current data counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Meals logged: {meals?.length || 0}</div>
            <div>Moods tracked: {moods?.length || 0}</div>
            <div>Journal entries: {journalEntries?.length || 0}</div>
            <div>Wellbeing practices: {practicesData.length}</div>
          </CardContent>
        </Card>
        
        <div className="text-xs text-muted-foreground">
          <p>WellMate Developer Tools v1.0</p>
          <p>For testing and debugging only. Do not expose in production.</p>
        </div>
      </div>
    </div>
  );
}
