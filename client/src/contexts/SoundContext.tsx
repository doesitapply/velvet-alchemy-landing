import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface SoundContextType {
  playClick: () => void;
  playHover: () => void;
  playType: () => void;
  playSuccess: () => void;
  playError: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  
  // Using AudioContext for synthesized sounds to avoid external assets
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playTone = (freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
    if (isMuted || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playClick = () => playTone(800, 'sine', 0.1, 0.05);
  const playHover = () => playTone(400, 'sine', 0.05, 0.02);
  const playType = () => playTone(1200, 'square', 0.03, 0.02);
  const playSuccess = () => {
    playTone(600, 'sine', 0.1, 0.05);
    setTimeout(() => playTone(900, 'sine', 0.2, 0.05), 100);
  };
  const playError = () => {
    playTone(200, 'sawtooth', 0.2, 0.05);
    setTimeout(() => playTone(150, 'sawtooth', 0.2, 0.05), 100);
  };

  const toggleMute = () => setIsMuted(!isMuted);

  return (
    <SoundContext.Provider value={{ playClick, playHover, playType, playSuccess, playError, isMuted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
