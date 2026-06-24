import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "700px",
  emptyStateMessage = "How can I help you transform your business today?",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  // Scroll on message changes
  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Keep focus on input
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col glass-panel overflow-hidden transition-all duration-500",
        className
      )}
      style={{ height }}
    >
      {/* Header (Optional but good for premium feel) */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-gold animate-pulse" />
          <span className="font-serif italic text-gold tracking-wide">Alchemical Intelligence</span>
        </div>
        {isLoading && (
          <span className="text-[10px] font-mono text-gold/50 animate-pulse uppercase tracking-widest">
            Processing...
          </span>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden relative">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-6 items-center justify-center text-center">
            <div className="space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="mx-auto size-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Sparkles className="size-8 text-gold mt-0.5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif italic text-gold">{emptyStateMessage}</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  I can analyze your website screenshot, draft high-ticket outreach, or help you map out your next business move.
                </p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 pt-4">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-none border border-white/10 bg-white/5 px-4 py-2 text-xs font-mono transition-all hover:bg-gold hover:text-black hover:border-gold disabled:opacity-50"
                    >
                      {prompt.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full px-6 py-8">
            <div className="flex flex-col space-y-8 pb-4">
              {displayMessages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "size-8 shrink-0 rounded-none border flex items-center justify-center transition-all duration-300",
                    message.role === "assistant" 
                      ? "bg-gold/10 border-gold/30 group-hover:bg-gold group-hover:text-black" 
                      : "bg-white/5 border-white/20"
                  )}>
                    {message.role === "assistant" ? (
                      <Sparkles className="size-4" />
                    ) : (
                      <User className="size-4" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn(
                    "max-w-[85%] space-y-1",
                    message.role === "user" ? "text-right" : "text-left"
                  )}>
                    <div className={cn(
                      "px-4 py-3 text-sm transition-all duration-300",
                      message.role === "user"
                        ? "bg-gold text-black font-medium selection:bg-black/20"
                        : "bg-white/5 border border-white/10 text-foreground selection:bg-gold/20"
                    )}>
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      {message.role} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4 animate-in fade-in duration-300">
                  <div className="size-8 shrink-0 bg-gold/10 border border-gold/30 flex items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-gold" />
                  </div>
                  <div className="bg-white/5 border border-white/10 px-4 py-3">
                    <div className="flex gap-1">
                      <div className="size-1.5 bg-gold/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="size-1.5 bg-gold/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="size-1.5 bg-gold/50 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-md">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-3"
        >
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full bg-white/5 border-white/20 focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all resize-none min-h-[50px] max-h-[200px] py-3 px-4 rounded-none font-mono text-sm"
              rows={1}
            />
            <div className="absolute bottom-2 right-2 text-[10px] font-mono text-muted-foreground pointer-events-none">
              ⏎ SEND
            </div>
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-[50px] w-[50px] bg-gold hover:bg-gold/90 text-black rounded-none shadow-lg shadow-gold/10 transition-all hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5 ml-0.5" />
            )}
          </Button>
        </form>
        <p className="mt-3 text-[10px] text-center font-mono text-muted-foreground uppercase tracking-widest opacity-50">
          Powered by Velvet Alchemy Visionary Engine
        </p>
      </div>
    </div>
  );
}
