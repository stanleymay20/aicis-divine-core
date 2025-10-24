import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

export const EducationPanel = () => {
  const [loading, setLoading] = useState(false);
  const [educationData, setEducationData] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchEducationData = async () => {
    try {
      const { data } = await supabase
        .from('education_metrics' as any)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (data) setEducationData(data);
    } catch (error) {
      console.error('Error fetching education data:', error);
    }
  };

  const analyzeEducation = async () => {
    setLoading(true);
    try {
      // Simulate analysis
      const avgLiteracy = educationData.reduce((sum, d) => sum + (Number(d.literacy_rate) || 0), 0) / (educationData.length || 1);
      
      toast({
        title: "Education Analysis Complete",
        description: `Average literacy rate: ${avgLiteracy.toFixed(1)}%. ${educationData.length} countries analyzed.`,
      });
      
      await fetchEducationData();
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducationData();
  }, []);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Knowledge & Education</h3>
            <p className="text-sm text-muted-foreground">AI education tracking & research intelligence</p>
          </div>
        </div>
        <Button onClick={analyzeEducation} disabled={loading} size="sm">
          Analyze Education
        </Button>
      </div>

      <div className="space-y-4">
        {educationData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={educationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="country" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--primary))",
                    borderRadius: "8px"
                  }}
                />
                <Bar dataKey="literacy_rate" fill="hsl(var(--primary))" />
                <Bar dataKey="ai_education_index" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {educationData.map((record) => (
                <div key={record.id} className="p-3 bg-background/50 rounded-lg border border-border/50">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium">{record.country}</span>
                    <TrendingUp className="w-4 h-4 text-chart-2" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Literacy:</span>
                      <span className="font-medium text-primary">
                        {Number(record.literacy_rate || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">AI Education:</span>
                      <span className="font-medium text-chart-2">
                        {Number(record.ai_education_index || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Enrollment:</span>
                      <span className="font-medium">
                        {Number(record.enrollment_rate || 0).toFixed(1)}%
                      </span>
                    </div>
                    {record.research_output && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Research:</span>
                        <span className="font-medium">{record.research_output} papers</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No education data available. System is collecting metrics.</p>
          </div>
        )}
      </div>
    </Card>
  );
};
