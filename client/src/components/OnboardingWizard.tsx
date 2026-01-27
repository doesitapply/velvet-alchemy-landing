import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, DollarSign, Search, FileText, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

/**
 * Onboarding Wizard - Guides new users through first revenue
 * 
 * Steps:
 * 1. Run scraper to find leads
 * 2. Review AI audit results
 * 3. Send invoice to client
 * 4. Receive payment
 */

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  actionText: string;
  actionLink: string;
}

export function OnboardingWizard() {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Fetch onboarding progress
  const { data: progress, isLoading } = trpc.onboarding.getProgress.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const steps: OnboardingStep[] = [
    {
      id: "scraper",
      title: "Find Your First Leads",
      description: "Use the Business Scraper to find local businesses with websites",
      icon: <Search className="h-5 w-5" />,
      completed: progress?.hasCompletedScraper || false,
      actionText: "Run Scraper",
      actionLink: "/scraper",
    },
    {
      id: "audit",
      title: "Review AI Audit",
      description: "Let AI analyze website quality and generate audit reports",
      icon: <FileText className="h-5 w-5" />,
      completed: progress?.hasReviewedAudit || false,
      actionText: "View Leads",
      actionLink: "/leads",
    },
    {
      id: "invoice",
      title: "Send Your First Invoice",
      description: "Choose a package and send payment link to a client",
      icon: <Send className="h-5 w-5" />,
      completed: progress?.hasSentInvoice || false,
      actionText: "Send Invoice",
      actionLink: "/leads",
    },
    {
      id: "payment",
      title: "Receive Payment",
      description: "Get paid when client completes Stripe checkout",
      icon: <DollarSign className="h-5 w-5" />,
      completed: progress?.hasReceivedPayment || false,
      actionText: "Track Revenue",
      actionLink: "/revenue",
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercentage = (completedCount / steps.length) * 100;
  const isComplete = completedCount === steps.length;

  // Auto-collapse when complete
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setIsExpanded(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (isLoading) {
    return null; // Don't show until data loads
  }

  if (isComplete && !isExpanded) {
    return (
      <Card className="p-4 bg-gradient-to-r from-gold/10 to-gold/5 border-gold/20">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-gold" />
            <span className="font-mono text-sm text-gold">Onboarding Complete</span>
          </div>
          <span className="text-xs text-muted-foreground">Click to expand</span>
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-background to-muted/20 border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif text-xl text-gold mb-1">Getting Started</h3>
          <p className="text-sm text-muted-foreground font-mono">
            {isComplete
              ? "🎉 You're ready to make money!"
              : `${completedCount}/${steps.length} steps completed`}
          </p>
        </div>
        {!isComplete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? "Minimize" : "Expand"}
          </Button>
        )}
      </div>

      <Progress value={progressPercentage} className="mb-6 h-2" />

      {isExpanded && (
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                step.completed
                  ? "bg-gold/5 border-gold/20"
                  : "bg-muted/30 border-white/5 hover:border-white/10"
              }`}
            >
              <div className="mt-1">
                {step.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-gold" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {step.icon}
                  <h4 className="font-mono text-sm font-medium">
                    {step.title}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {step.description}
                </p>

                {!step.completed && (
                  <Link href={step.actionLink}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gold/20 hover:bg-gold/10 hover:text-gold"
                    >
                      {step.actionText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}

                {step.completed && (
                  <span className="text-xs text-gold font-mono">✓ Completed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isComplete && (
        <div className="mt-6 p-4 bg-gold/10 border border-gold/20 rounded-lg">
          <p className="text-sm text-gold font-mono mb-2">
            🎯 You've completed onboarding!
          </p>
          <p className="text-xs text-muted-foreground">
            Now focus on scaling: run more scraper searches, review high-scoring audits,
            and send invoices to close more deals.
          </p>
        </div>
      )}
    </Card>
  );
}
