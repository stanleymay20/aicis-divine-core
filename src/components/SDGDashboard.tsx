import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, AlertCircle } from "lucide-react";

const SDG_GOALS = [
  { goal: 1, title: "No Poverty", color: "hsl(var(--chart-1))" },
  { goal: 2, title: "Zero Hunger", color: "hsl(var(--chart-2))" },
  { goal: 3, title: "Good Health", color: "hsl(var(--chart-3))" },
  { goal: 4, title: "Quality Education", color: "hsl(var(--chart-4))" },
  { goal: 5, title: "Gender Equality", color: "hsl(var(--chart-5))" },
  { goal: 6, title: "Clean Water", color: "hsl(var(--chart-1))" },
  { goal: 7, title: "Clean Energy", color: "hsl(var(--chart-2))" },
  { goal: 8, title: "Economic Growth", color: "hsl(var(--chart-3))" },
  { goal: 9, title: "Innovation", color: "hsl(var(--chart-4))" },
  { goal: 10, title: "Reduced Inequalities", color: "hsl(var(--chart-5))" },
  { goal: 11, title: "Sustainable Cities", color: "hsl(var(--chart-1))" },
  { goal: 12, title: "Responsible Consumption", color: "hsl(var(--chart-2))" },
  { goal: 13, title: "Climate Action", color: "hsl(var(--chart-3))" },
  { goal: 14, title: "Life Below Water", color: "hsl(var(--chart-4))" },
  { goal: 15, title: "Life on Land", color: "hsl(var(--chart-5))" },
  { goal: 16, title: "Peace & Justice", color: "hsl(var(--chart-1))" },
  { goal: 17, title: "Partnerships", color: "hsl(var(--chart-2))" },
];

export default function SDGDashboard() {
  const { data: progress, isLoading } = useQuery({
    queryKey: ['sdg-progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdg_progress')
        .select('*')
        .order('goal');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: mappings } = useQuery({
    queryKey: ['sdg-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdg_mappings')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const getProgressForGoal = (goalNumber: number) => {
    const goalProgress = progress?.find(p => p.goal === goalNumber);
    return goalProgress?.progress_percent || 0;
  };

  const getMappingsCount = (goalNumber: number) => {
    return mappings?.filter(m => m.sdg_goal === goalNumber).length || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">UN Sustainable Development Goals</h2>
          <p className="text-muted-foreground mt-1">Global progress tracking across all 17 SDGs</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Target className="w-4 h-4" />
          2030 Agenda
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 17 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-20 bg-muted rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SDG_GOALS.map(({ goal, title, color }) => {
            const progressValue = getProgressForGoal(goal);
            const mappingsCount = getMappingsCount(goal);

            return (
              <Card 
                key={goal} 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: color }}
                      >
                        {goal}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm leading-tight">{title}</h3>
                      </div>
                    </div>
                  </div>

                  <Progress value={progressValue} className="h-2" />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {progressValue.toFixed(1)}%
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {mappingsCount} indicators
                    </Badge>
                  </div>

                  {progressValue < 50 && (
                    <div className="flex items-center gap-1 text-xs text-orange-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>Needs attention</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Overall Progress</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Global Average</span>
              <span className="text-sm font-medium">
                {progress?.length 
                  ? (progress.reduce((sum, p) => sum + Number(p.progress_percent || 0), 0) / progress.length).toFixed(1)
                  : 0}%
              </span>
            </div>
            <Progress 
              value={progress?.length 
                ? (progress.reduce((sum, p) => sum + Number(p.progress_percent || 0), 0) / progress.length)
                : 0
              } 
            />
          </div>
        </div>
      </Card>
    </div>
  );
}