import { useCallback, useRef, useState } from "react";

/* ===========================================================================
 * Stub for @workspace/integrations-openai-ai-react
 * Voice input uses the browser Web Speech API when available; item
 * suggestions are a safe no-op until an AI endpoint is wired in.
 * ======================================================================== */

export interface UseVoiceInputOptions {
  onResult?: (text: string) => void;
  onError?: (err: unknown) => void;
  lang?: string;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  supported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;
  const supported = Boolean(SR);

  const start = useCallback(() => {
    if (!SR) {
      options.onError?.(new Error("Speech recognition not supported"));
      return;
    }
    try {
      const rec = new SR();
      rec.lang = options.lang ?? "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        const text = Array.from(e.results).map((r: any) => r[0].transcript).join("");
        setTranscript(text);
        if (e.results[e.results.length - 1].isFinal) options.onResult?.(text);
      };
      rec.onerror = (e: any) => options.onError?.(e);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (err) {
      options.onError?.(err);
      setIsListening(false);
    }
  }, [SR, options]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { isListening, transcript, supported, start, stop, reset };
}

export interface ItemSuggestion {
  description: string;
  unitPrice?: number;
  [k: string]: any;
}

export function useItemSuggestions(_input?: string) {
  return {
    suggestions: [] as ItemSuggestion[],
    isLoading: false,
    loading: false,
    error: null as unknown,
    refetch: () => {},
  };
}
