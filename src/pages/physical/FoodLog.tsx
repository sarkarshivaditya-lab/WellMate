import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { PlusIcon } from "lucide-react";

export default function FoodLog() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Today's Meals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No meals logged today</p>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Meal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
