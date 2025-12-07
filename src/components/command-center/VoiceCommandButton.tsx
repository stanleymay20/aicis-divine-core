import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceCommandButtonProps {
  onCommand: (command: string) => void;
  className?: string;
}

export const VoiceCommandButton = ({ onCommand, className }: VoiceCommandButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error("Voice commands not supported in this browser");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      setTranscript(text);

      if (result.isFinal) {
        onCommand(text);
        setIsListening(false);
        toast.success(`Command: "${text}"`);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error !== "aborted") {
        toast.error("Voice recognition failed");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [isSupported, onCommand]);

  if (!isSupported) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn("h-10 w-10 opacity-50 cursor-not-allowed", className)}
        disabled
        title="Voice commands not supported"
      >
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant={isListening ? "default" : "outline"}
        size="icon"
        className={cn(
          "h-10 w-10 transition-all",
          isListening && "bg-primary animate-pulse ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
          className
        )}
        onClick={startListening}
        disabled={isListening}
      >
        {isListening ? (
          <Volume2 className="h-4 w-4 animate-pulse" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Listening indicator */}
      {isListening && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-lg shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "100ms" }} />
              <span className="w-1 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "200ms" }} />
              <span className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
              <span className="w-1 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "400ms" }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {transcript || "Listening..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
