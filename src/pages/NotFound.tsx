import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404: attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8 text-center">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        WellMate
      </p>

      <div className="space-y-2 max-w-xs">
        <h1 className="text-2xl font-semibold text-foreground">
          This page doesn't exist
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The link you followed may be outdated, or this section isn't available yet.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <Button asChild>
          <Link to="/physical">Go to dashboard</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </div>
    </div>
  );
}
