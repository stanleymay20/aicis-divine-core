import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, AlertTriangle, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CountryDeepDive from './CountryDeepDive';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  data?: any;
  timestamp: Date;
}

export default function AICISInterface() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'AICIS Global Command Center initialized. Query global intelligence, country profiles, or critical incidents.',
      timestamp: new Date()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);

  // Load critical alerts on mount
  useState(() => {
    loadCriticalAlerts();
  });

  const loadCriticalAlerts = async () => {
    const { data } = await supabase
      .from('critical_alerts')
      .select('*')
      .gte('triggered_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('triggered_at', { ascending: false })
      .limit(10);
    
    if (data) setCriticalAlerts(data);
  };

  const handleQuery = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setInput('');

    try {
      const { data, error } = await supabase.functions.invoke('aicis-query', {
        body: { query: input }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || 'Query processed',
        data: data,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh alerts if incident query
      if (data.intent === 'critical_incidents') {
        loadCriticalAlerts();
      }

    } catch (error: any) {
      console.error('Query error:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      urgent: 'destructive',
      high: 'warning',
      medium: 'default',
      low: 'secondary'
    };
    return colors[level] || 'default';
  };

  return (
    <div className="space-y-4">
      {/* Critical Incidents Strip */}
      {criticalAlerts.length > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Critical Incidents (Last 6h)</h3>
            <Badge variant="destructive">{criticalAlerts.filter(a => a.level === 'urgent').length}</Badge>
          </div>
          <div className="space-y-2">
            {criticalAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-2 rounded bg-background/50">
                <Badge variant={getLevelColor(alert.level) as any}>{alert.level}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.headline}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.country || alert.iso3} • {new Date(alert.triggered_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Main Interface */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b">
            <Activity className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold">AICIS Global Command Center</h2>
              <p className="text-sm text-muted-foreground">Natural-language intelligence & system control</p>
            </div>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className="space-y-2">
                  <div className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg p-3 max-w-[80%] ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' :
                      msg.role === 'system' ? 'bg-muted' : 'bg-secondary'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* Render query results */}
                  {msg.data && msg.data.intent === 'critical_incidents' && msg.data.results && (
                    <div className="space-y-2 pl-4">
                      {msg.data.results.slice(0, 10).map((alert: any) => (
                        <Card key={alert.id} className="p-3">
                          <div className="flex items-start gap-3">
                            <Badge variant={getLevelColor(alert.level) as any}>{alert.level}</Badge>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{alert.headline}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {alert.country} • Severity: {alert.severity?.toFixed(0)}
                              </p>
                              {alert.security_incidents?.url && (
                                <a 
                                  href={alert.security_incidents.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  View source →
                                </a>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Render country dashboard */}
                  {msg.data && msg.data.intent === 'country_dashboard' && msg.data.results && (
                    <div className="mt-4">
                      <CountryDeepDive
                        location={{ name: msg.data.country, iso3: msg.data.iso3, lat: 0, lon: 0, type: 'country' }}
                        profile={msg.data.results}
                        completeness_overall={0.7}
                        notes={[]}
                      />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              placeholder="Query: 'Are there killings around the world?', 'Governance for Nauru', 'Country overview USA'"
              disabled={loading}
            />
            <Button onClick={handleQuery} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
