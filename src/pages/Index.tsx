import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CommandCenter } from "@/components/command-center/CommandCenter";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary rounded-xl blur-xl opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-3xl font-orbitron font-bold text-primary-foreground">A</span>
            </div>
          </div>
          <div className="text-primary text-xl font-orbitron animate-pulse">Initializing AICIS...</div>
          <div className="text-muted-foreground text-sm">AI Civilization Intelligence System</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <CommandCenter />;
};

export default Index;
