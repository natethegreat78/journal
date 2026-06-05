import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimResult, setInterimResult] = useState('');
  const [finalResult, setFinalResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimResult(interim);
        if (final) {
          setFinalResult(prev => prev + final);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          setError(`Error: ${event.error}`);
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        // Automatically restart if we're still supposed to be recording
        // (SpeechRecognition sometimes stops on its own after silence)
        if (isRecording) {
          try {
            recognition.start();
          } catch (e) {
            console.error("Could not restart recognition", e);
            setIsRecording(false);
          }
        }
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      setError(e.message || "Failed to initialize speech recognition.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setFinalResult('');
    setInterimResult('');
    setIsRecording(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    setIsRecording(false);
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.error(e);
    }
  }, []);

  return {
    isRecording,
    interimResult,
    finalResult,
    error,
    startRecording,
    stopRecording
  };
}
