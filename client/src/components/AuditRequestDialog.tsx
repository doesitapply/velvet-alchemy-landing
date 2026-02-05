import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AuditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditRequestDialog({ open, onOpenChange }: AuditRequestDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const createAudit = trpc.leads.createPublic.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Audit Started!", {
        description: "We're analyzing your website now. Results will be ready in 2-3 minutes.",
      });
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to start audit. Please try again.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate URL format
    try {
      new URL(websiteUrl);
    } catch {
      toast.error("Invalid URL", {
        description: "Please enter a valid website URL (e.g., https://example.com)",
      });
      return;
    }

    createAudit.mutate({
      companyName,
      websiteUrl,
      contactEmail: "unknown@example.com",
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after closing
    setTimeout(() => {
      setCompanyName("");
      setWebsiteUrl("");
      setSubmitted(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gold/20">
        {!submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gold">Get Your Free Website Audit</DialogTitle>
              <DialogDescription className="text-white/70">
                Enter your website details below. We'll analyze your site and show you exactly what's costing you customers.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-white">Company Name</Label>
                <Input
                  id="audit-form-input-company-name"
                  name="companyName"
                  placeholder="e.g., Acme Restaurant"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="bg-black/50 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-white">Website URL</Label>
                <Input
                  id="audit-form-input-website-url"
                  name="websiteUrl"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  required
                  className="bg-black/50 border-white/20 text-white"
                />
              </div>

              <Button
                id="audit-form-button-submit"
                type="submit"
                disabled={createAudit.isPending}
                className="w-full bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-600 hover:to-gold text-black font-bold"
              >
                {createAudit.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Start Free Audit"
                )}
              </Button>

              <p className="text-xs text-white/50 text-center">
                No credit card required. Results in 2-3 minutes.
              </p>
            </form>
          </>
        ) : (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gold">Audit In Progress!</DialogTitle>
              <DialogDescription className="text-white/70">
                We're analyzing {companyName}'s website right now. This usually takes 2-3 minutes.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-white/60">
              You can close this window. We'll email you when your audit is ready, or check back in a few minutes.
            </p>
            <Button
              id="audit-form-button-close"
              onClick={handleClose}
              variant="outline"
              className="border-gold/30 text-gold hover:bg-gold/10"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
