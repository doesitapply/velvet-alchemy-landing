import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Lock, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestAccessDialog({ open, onOpenChange }: RequestAccessDialogProps) {
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [email, setEmail] = useState('');
  const [targetNiche, setTargetNiche] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStep('success');
      } else {
        setErrorMessage(data.message || 'Failed to join waitlist');
        setStep('error');
      }
    },
    onError: (error) => {
      setErrorMessage(error.message || 'An unexpected error occurred');
      setStep('error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');
    joinWaitlist.mutate({ email, targetNiche: targetNiche || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#0c0c0c] border-white/10 text-white rounded-none">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-2xl text-white">Request Access</DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            The system is currently in closed beta. Enter your credentials to join the waitlist.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs text-muted-foreground">WORK_EMAIL</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white font-mono rounded-none focus:border-[#F7E7CE] focus:ring-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niche" className="font-mono text-xs text-muted-foreground">TARGET_NICHE</Label>
              <Input
                id="niche"
                placeholder="e.g. Luxury Real Estate"
                value={targetNiche}
                onChange={(e) => setTargetNiche(e.target.value)}
                className="bg-white/5 border-white/10 text-white font-mono rounded-none focus:border-[#F7E7CE] focus:ring-0"
              />
            </div>
            <Button type="submit" className="w-full bg-[#F7E7CE] text-black hover:bg-white rounded-none font-mono text-xs h-10">
              SUBMIT REQUEST
            </Button>
          </form>
        )}

        {step === 'processing' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 text-[#F7E7CE] animate-spin" />
            <div className="font-mono text-xs text-muted-foreground animate-pulse">ENCRYPTING_DATA...</div>
          </div>
        )}

        {step === 'error' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif italic text-xl text-white">Error</h3>
              <p className="font-mono text-xs text-muted-foreground max-w-[250px] mx-auto">
                {errorMessage}
              </p>
            </div>
            <Button 
              onClick={() => { setStep('form'); setErrorMessage(''); }} 
              variant="outline" 
              className="mt-4 border-white/10 hover:bg-white/5 text-white rounded-none font-mono text-xs"
            >
              TRY AGAIN
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-[#00FF41]/10 flex items-center justify-center border border-[#00FF41]/20">
              <CheckCircle2 className="h-6 w-6 text-[#00FF41]" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif italic text-xl text-white">Request Received</h3>
              <p className="font-mono text-xs text-muted-foreground max-w-[250px] mx-auto">
                Your dossier has been created. We will contact you via secure channel if you are selected.
              </p>
            </div>
            <Button 
              onClick={() => onOpenChange(false)} 
              variant="outline" 
              className="mt-4 border-white/10 hover:bg-white/5 text-white rounded-none font-mono text-xs"
            >
              CLOSE TERMINAL
            </Button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] font-mono text-muted-foreground/50">
          <Lock className="h-3 w-3" />
          <span>256-BIT ENCRYPTION ACTIVE</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
