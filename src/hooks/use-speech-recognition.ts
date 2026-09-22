
"use client";

import { useState, useEffect, useCallback } from 'react';

let recognition: SpeechRecognition | null = null;
if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-AU';
  recognition.interimResults = false;
}

export const useSpeechRecognition = () => {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startListening = useCallback(() => {
    if (listening || !recognition) return;
    setListening(true);
    setTranscript('');
    setError(null);
    recognition.start();
  }, [listening]);

  const stopListening = useCallback(() => {
    if (!listening || !recognition) return;
    setListening(false);
    recognition.stop();
  }, [listening]);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1][0].transcript;
      setTranscript(result);
      stopListening();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    return () => {
      recognition?.stop();
    };
  }, [stopListening]);

  return {
    transcript,
    listening,
    error,
    isSupported: !!recognition,
    startListening,
    stopListening,
  };
};
