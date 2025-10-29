import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Brain, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VoiceControls } from './VoiceControls';
import { useSpeech } from '@/hooks/useSpeech';
import {
  buildContextWindow,
  estimateTokens,
  generateSessionSummary,
  saveToSessionStorage,
  loadFromSessionStorage,
  type ChatMessage,
} from '@/lib/memory';

interface Analysis {
  summary: string;
  key_metrics?: Array<{ label: string; value: string; trend?: 'up' | 'down' }>;
  critical_regions?: string[];
  recommendations?: string[];
  data_sources?: string[];
  risk_level?: string;
  confidence?: number;
}

interface Message extends ChatMessage {
  analysis?: Analysis;
  timestamp: Date;
  rating?: number;
}

export function AICISCorePanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { speak, isSupported: voiceSupported } = useSpeech();

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      if (user?.id) {
        // Create or load existing session
        const { data: sessions } = await supabase
          .from('ai_chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('last_active_at', { ascending: false })
          .limit(1);

        if (sessions && sessions.length > 0) {
          const session = sessions[0];
          setSessionId(session.id);

          // Load messages
          const { data: msgs } = await supabase
            .from('ai_chat_messages')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: true });

          if (msgs) {
            setMessages(
              msgs.map((m) => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
                timestamp: new Date(m.created_at),
                id: m.id,
              }))
            );
          }
        } else {
          // Create new session
          const { data: newSession } = await supabase
            .from('ai_chat_sessions')
            .insert({
              user_id: user.id,
              title: 'AICIS Core Session',
            })
            .select()
            .single();

          if (newSession) {
            setSessionId(newSession.id);
          }
        }
      } else {
        // Anonymous user - use session storage
        const tempSessionId = 'anon_' + Date.now();
        setSessionId(tempSessionId);
        const stored = loadFromSessionStorage(tempSessionId);
        if (stored) {
          setMessages(stored.map(m => ({ ...m, timestamp: new Date() })) as Message[]);
        }
      }
    };

    initSession();
  }, []);

  const saveMessage = async (message: Message) => {
    if (userId && sessionId && !sessionId.startsWith('anon_')) {
      // Save to database
      await supabase.from('ai_chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: message.role,
        content: message.content,
        tokens_est: estimateTokens(message.content),
      });

      // Update session activity
      await supabase
        .from('ai_chat_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', sessionId);
    } else if (sessionId) {
      // Save to session storage
      saveToSessionStorage(sessionId, messages);
    }
  };

  const handleQuery = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save user message
    await saveMessage(userMessage);

    try {
      // Build context from recent messages
      const context = buildContextWindow([...messages, userMessage]);
      
      // Generate session summary if needed (every 10 messages)
      if (messages.length > 0 && messages.length % 10 === 0) {
        const summary = generateSessionSummary(messages);
        // Could save this as a system message
      }

      // Call edge function with context
      const { data, error } = await supabase.functions.invoke('jarvis-query', {
        body: { 
          query: input,
          context: context.map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.analysis.summary,
        analysis: data.analysis,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await saveMessage(assistantMessage);

      // Auto-read if enabled
      const autoRead = localStorage.getItem('aicis_auto_read') === 'true';
      if (autoRead && voiceSupported) {
        speak(data.analysis.summary);
      }

      // Log feedback
      if (userId) {
        await supabase.from('query_feedback').insert({
          user_id: userId,
          query_text: input,
          response_relevance: data.analysis.confidence || 0.8,
          top_apis: data.analysis.data_sources || {},
          execution_time_ms: 0,
        });
      }
    } catch (error) {
      console.error('Query error:', error);
      toast({
        title: 'Query Failed',
        description: error instanceof Error ? error.message : 'Failed to process query',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async (messageIndex: number, rating: number) => {
    const message = messages[messageIndex];
    if (message.role !== 'assistant' || !userId) return;

    setMessages((prev) =>
      prev.map((m, i) => (i === messageIndex ? { ...m, rating } : m))
    );

    // Update feedback
    await supabase
      .from('query_feedback')
      .update({ user_satisfaction: rating })
      .eq('user_id', userId)
      .eq('query_text', messages[messageIndex - 1]?.content);
  };

  const handleDictate = (text: string) => {
    setInput(text);
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-primary/20">
      <div className="p-4 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold font-orbitron">AICIS Core</h2>
            <p className="text-xs text-muted-foreground">Autonomous awareness active</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50 text-primary" />
              <p className="font-rajdhani">AICIS Core Online</p>
              <p className="text-sm mt-2 text-muted-foreground">
                Query global intelligence data across all divisions
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                Try: "Optimize food production" or "Analyze climate vulnerability"
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
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

                    {msg.analysis.critical_regions &&
                      msg.analysis.critical_regions.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold mb-1">Critical Regions:</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.analysis.critical_regions.map((r, i) => (
                              <Badge key={i} variant="outline">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    {msg.analysis.recommendations &&
                      msg.analysis.recommendations.length > 0 && (
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

                    {/* Rating */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRating(idx, star)}
                            className="hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`h-3 w-3 ${
                                msg.rating && star <= msg.rating
                                  ? 'fill-primary text-primary'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
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

      <div className="p-4 border-t border-primary/20 space-y-2">
        <VoiceControls onDictate={handleDictate} />
        
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            placeholder="Query AICIS Core intelligence..."
            disabled={loading}
            className="bg-input border-primary/20"
          />
          <Button onClick={handleQuery} disabled={loading || !input.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
