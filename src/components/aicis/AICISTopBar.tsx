import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const AICISTopBar = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();

  return (
    <header className="h-12 bg-card border-b border-border flex items-center justify-between px-4 z-50 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => {
              // Trigger sidebar toggle via custom event
              document.dispatchEvent(new CustomEvent("toggle-sidebar"));
            }}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-xs">AI</span>
          </div>
          <span className="text-sm font-semibold tracking-tight hidden sm:inline">AICIS</span>
        </div>
      </div>

      {/* Right */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <User className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium truncate">{user?.email?.split("@")[0] || "Operator"}</p>
          </div>
          <DropdownMenuItem onClick={signOut} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};
