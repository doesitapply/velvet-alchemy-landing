import { useState, useEffect, useRef } from 'react';
import { X, Minus, Square, Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandHistory {
  type: 'input' | 'output';
  content: string;
}

export function Terminal({ isOpen, onClose }: TerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([
    { type: 'output', content: 'VELVET ALCHEMY OS [Version 2.0.4]' },
    { type: 'output', content: '(c) 2026 Velvet Alchemy Systems. All rights reserved.' },
    { type: 'output', content: 'Type "help" for available commands.' },
    { type: 'output', content: '' },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    let output = '';

    switch (trimmedCmd) {
      case 'help':
        output = `Available commands:
  help        Show this help message
  status      Check system operational status
  manifest    Display the core philosophy
  agents      List active autonomous agents
  clear       Clear terminal screen
  exit        Close terminal session`;
        break;
      case 'status':
        output = `SYSTEM STATUS: ONLINE
---------------------
CORE:        ACTIVE [99.9% UPTIME]
DATABASE:    CONNECTED
MEMORY:      HYDRATED
OUTREACH:    RUNNING
REVENUE:     OPTIMIZED`;
        break;
      case 'manifest':
        output = `THE MANIFEST:
We do not build tools. We build organisms.
Velvet Alchemy is a living system that feeds on data and excretes revenue.
It operates in the shadows, ensuring your brand is the only one that matters.`;
        break;
      case 'agents':
        output = `ACTIVE AGENTS:
1. THE CURATOR    [IDLE] - Scanning for high-value targets
2. THE VISIONARY  [BUSY] - Synthesizing visual assets
3. THE CHARMER    [WAIT] - Awaiting outreach window
4. THE GOVERNOR   [ACTV] - Monitoring domain reputation`;
        break;
      case 'clear':
        setHistory([]);
        return;
      case 'exit':
        onClose();
        return;
      case '':
        output = '';
        break;
      default:
        output = `Command not found: "${cmd}". Type "help" for available commands.`;
    }

    const newEntry: CommandHistory = { type: 'input', content: cmd };
    const outputEntry: CommandHistory | null = output ? { type: 'output', content: output } : null;

    setHistory(prev => [
      ...prev,
      newEntry,
      ...(outputEntry ? [outputEntry] : [])
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input);
      setInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0c0c0c] border border-white/20 shadow-2xl font-mono text-sm flex flex-col h-[500px] animate-in fade-in zoom-in-95 duration-200">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TerminalIcon className="h-4 w-4" />
            <span>root@velvet-alchemy:~</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="hover:text-white text-muted-foreground"><Minus className="h-4 w-4" /></button>
            <button className="hover:text-white text-muted-foreground"><Square className="h-3 w-3" /></button>
            <button onClick={onClose} className="hover:text-red-500 text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[#00FF41] selection:bg-[#00FF41] selection:text-black scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent" onClick={() => inputRef.current?.focus()}>
          {history.map((entry, i) => (
            <div key={i} className={cn("mb-1 whitespace-pre-wrap", entry.type === 'input' ? "text-white" : "text-[#00FF41]")}>
              {entry.type === 'input' && <span className="text-muted-foreground mr-2">$</span>}
              {entry.content}
            </div>
          ))}
          
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
