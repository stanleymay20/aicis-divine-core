import { Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSpeech } from '@/hooks/useSpeech';
import { useEffect, useState } from 'react';

interface VoiceControlsProps {
  onDictate?: (text: string) => void;
}

export function VoiceControls({ onDictate }: VoiceControlsProps) {
  const {
    speaking,
    stop,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSupported,
    startListening,
    listening,
    recognitionSupported,
  } = useSpeech();

  const [autoRead, setAutoRead] = useState(false);

  // Load auto-read preference
  useEffect(() => {
    const saved = localStorage.getItem('aicis_auto_read');
    if (saved) setAutoRead(saved === 'true');
  }, []);

  const handleAutoReadToggle = (checked: boolean) => {
    setAutoRead(checked);
    localStorage.setItem('aicis_auto_read', checked.toString());
  };

  const handleDictate = () => {
    if (listening || !onDictate) return;
    startListening(onDictate);
  };

  if (!isSupported) {
    return (
      <div className="text-xs text-muted-foreground">
        Voice not supported in this browser
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-card/50 rounded-lg border border-primary/10">
      {/* Stop/Resume Speaking */}
      <Button
        size="sm"
        variant="ghost"
        onClick={stop}
        disabled={!speaking}
        className="h-8"
      >
        {speaking ? (
          <>
            <VolumeX className="h-4 w-4 mr-1" />
            Stop
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4 mr-1" />
            Ready
          </>
        )}
      </Button>

      {/* Dictate */}
      {recognitionSupported && onDictate && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDictate}
          disabled={listening}
          className="h-8"
        >
          {listening ? (
            <>
              <MicOff className="h-4 w-4 mr-1 animate-pulse" />
              Listening...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-1" />
              Dictate
            </>
          )}
        </Button>
      )}

      {/* Voice Selection */}
      {voices.length > 0 && (
        <Select value={selectedVoice || undefined} onValueChange={setSelectedVoice}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Select voice" />
          </SelectTrigger>
          <SelectContent>
            {voices.map((voice) => (
              <SelectItem key={voice.name} value={voice.name}>
                {voice.name.substring(0, 25)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Auto-read toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="auto-read"
          checked={autoRead}
          onCheckedChange={handleAutoReadToggle}
        />
        <Label htmlFor="auto-read" className="text-xs cursor-pointer">
          Auto-read
        </Label>
      </div>
    </div>
  );
}

export const isAutoReadEnabled = () => localStorage.getItem('aicis_auto_read') === 'true';
