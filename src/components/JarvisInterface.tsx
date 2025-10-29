import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Analysis {
  summary: string;
  key_metrics?: Array<{ label: string; value: string }>;
  critical_regions?: string[];
  recommendations?: string[];
  data_sources?: string[];
  risk_level?: string;
  confidence?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  analysis?: Analysis;
  timestamp: Date;
}

export function JarvisInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleQuery = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-query', {
        body: { query: input }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.analysis.summary,
        analysis: data.analysis,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Query error:', error);
      toast({
        title: 'Query Failed',
        description: error instanceof Error ? error.message : 'Failed to process query',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card className="h-full flex flex-col bg-background/95 backdrop-blur">
      <div className="p-4 border-b flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">J.A.R.V.I.S. Global Analyst</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Ask me anything about global intelligence data</p>
              <p className="text-sm mt-2">Try: "Optimize food production" or "Analyze global health risks"</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                <p className="text-sm mb-2">{msg.content}</p>
                
                {msg.analysis && (
                  <div className="mt-3 space-y-2 text-xs">
                    {msg.analysis.risk_level && (
                      <Badge variant={getRiskColor(msg.analysis.risk_level)}>
                        Risk: {msg.analysis.risk_level}
                      </Badge>
                    )}
                    
                    {msg.analysis.key_metrics && msg.analysis.key_metrics.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold mb-1">Key Metrics:</p>
                        {msg.analysis.key_metrics.map((m, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{m.label}:</span>
                            <span className="font-mono">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {msg.analysis.critical_regions && msg.analysis.critical_regions.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold mb-1">Critical Regions:</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.analysis.critical_regions.map((r, i) => (
                            <Badge key={i} variant="outline">{r}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {msg.analysis.recommendations && msg.analysis.recommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold mb-1">Recommendations:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {msg.analysis.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {msg.analysis.confidence && (
                      <p className="text-muted-foreground mt-2">
                        Confidence: {(msg.analysis.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-2">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            placeholder="Ask J.A.R.V.I.S. about global intelligence..."
            disabled={loading}
          />
          <Button onClick={handleQuery} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
