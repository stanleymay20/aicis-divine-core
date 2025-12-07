import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: ["⌘", "K"], description: "Open command bar" },
  { keys: ["A"], description: "Toggle alerts panel" },
  { keys: ["D"], description: "Toggle analytics panel" },
  { keys: ["Esc"], description: "Close all panels" },
  { keys: ["M"], description: "Toggle minimap" },
  { keys: ["G"], description: "Global scan animation" },
  { keys: ["R"], description: "Reset map view" },
  { keys: ["+"], description: "Zoom in" },
  { keys: ["-"], description: "Zoom out" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

export const KeyboardShortcutsModal = ({ onClose }: ShortcutProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-card border border-primary/20 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-primary" />
            <h2 className="font-orbitron font-bold">Keyboard Shortcuts</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Shortcuts list */}
        <div className="p-6 space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="px-2 py-0.5 font-mono text-xs bg-muted/30"
                  >
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">
            Press <Badge variant="outline" className="mx-1 px-1.5 py-0 text-[10px]">?</Badge> anytime to view shortcuts
          </p>
        </div>
      </div>
    </div>
  );
};

export const useKeyboardShortcuts = (handlers: Record<string, () => void>) => {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Toggle shortcuts modal
      if (e.key === "?") {
        setShowShortcuts(prev => !prev);
        return;
      }

      // Handle registered shortcuts
      const key = e.key.toLowerCase();
      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }

      // Handle Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        handlers["cmd+k"]?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);

  return { showShortcuts, setShowShortcuts };
};
