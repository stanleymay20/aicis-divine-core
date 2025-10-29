import { useState, useEffect, useCallback } from 'react';

interface SpeechVoice {
  name: string;
  lang: string;
  default: boolean;
}

interface UseSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  voices: SpeechVoice[];
  selectedVoice: string | null;
  setSelectedVoice: (voiceName: string) => void;
  isSupported: boolean;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  listening: boolean;
  recognitionSupported: boolean;
}

export function useSpeech(): UseSpeechReturn {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voices, setVoices] = useState<SpeechVoice[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<string | null>(null);
  
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const recognitionSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // Load voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(
        availableVoices.map(v => ({
          name: v.name,
          lang: v.lang,
          default: v.default,
        }))
      );

      // Set default voice
      if (!selectedVoice && availableVoices.length > 0) {
        const defaultVoice = availableVoices.find(v => v.default) || availableVoices[0];
        const savedVoice = localStorage.getItem('aicis_voice');
        setSelectedVoiceState(savedVoice || defaultVoice.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, selectedVoice]);

  const speak = useCallback((text: string) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel(); // Stop any current speech

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedVoice) {
      const voice = window.speechSynthesis.getVoices().find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported, selectedVoice]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [isSupported]);

  const setSelectedVoice = useCallback((voiceName: string) => {
    setSelectedVoiceState(voiceName);
    localStorage.setItem('aicis_voice', voiceName);
  }, []);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!recognitionSupported) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
  }, [recognitionSupported]);

  const stopListening = useCallback(() => {
    if (!recognitionSupported) return;
    setListening(false);
  }, [recognitionSupported]);

  return {
    speak,
    stop,
    speaking,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSupported,
    startListening,
    stopListening,
    listening,
    recognitionSupported,
  };
}
