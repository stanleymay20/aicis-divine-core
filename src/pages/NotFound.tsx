import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl" />
            <AlertTriangle className="relative h-16 w-16 text-destructive" />
          </div>
        </div>
        <div>
          <h1 className="text-6xl font-bold font-orbitron text-primary mb-2">404</h1>
          <p className="text-xl text-muted-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground mt-2">
            The route you requested does not exist in the AICIS system.
          </p>
        </div>
        <Button asChild>
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Return to Command Center
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
