import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, AlertCircle, ArrowRight, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Step {
  id: number;
  title: string;
  description: string;
  action: string;
  completed: boolean;
}

export function OperatorWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      title: "Find Businesses",
      description: "Search for local businesses that need better websites",
      action: "scrape",
      completed: false,
    },
    {
      id: 2,
      title: "Review Audits",
      description: "Check which businesses have the worst websites (high prestige scores)",
      action: "review",
      completed: false,
    },
    {
      id: 3,
      title: "Send Invoices",
      description: "Send payment links to qualified leads",
      action: "invoice",
      completed: false,
    },
    {
      id: 4,
      title: "Track Revenue",
      description: "Monitor payments and celebrate wins",
      action: "revenue",
      completed: false,
    },
  ]);

  const { data: onboardingData } = trpc.onboarding.getProgress.useQuery();

  // Sync with backend onboarding progress
  useEffect(() => {
    if (onboardingData) {
      setSteps(prev => prev.map(step => ({
        ...step,
        completed: 
          (step.id === 1 && onboardingData.hasCompletedScraper) ||
          (step.id === 2 && onboardingData.hasReviewedAudit) ||
          (step.id === 3 && onboardingData.hasSentInvoice) ||
          (step.id === 4 && onboardingData.hasReceivedPayment) ||
          step.completed
      })));

      // Auto-advance to next incomplete step
      const nextIncomplete = steps.findIndex(s => !s.completed);
      if (nextIncomplete !== -1) {
        setCurrentStep(nextIncomplete + 1);
      }
    }
  }, [onboardingData]);

  const celebrateSuccess = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347'],
    });
    
    // Play success sound (optional)
    const audio = new Audio('/sounds/success.mp3');
    audio.play().catch(() => {/* Ignore if sound file missing */});
  };

  const handleStepComplete = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed: true } : step
    ));
    
    celebrateSuccess();
    toast.success(`✅ Step ${stepId} Complete!`, {
      description: "Great job! Moving to next step...",
      duration: 3000,
    });

    // Auto-advance to next step
    setTimeout(() => {
      if (stepId < steps.length) {
        setCurrentStep(stepId + 1);
      }
    }, 1500);
  };

  const handleUndo = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setSteps(prev => prev.map(step => 
        step.id === prevStep ? { ...step, completed: false } : step
      ));
      setCurrentStep(prevStep);
      toast.info("⏪ Undid last step");
    }
  };

  const getStepStatus = (step: Step) => {
    if (step.completed) return "completed";
    if (step.id === currentStep) return "current";
    if (step.id < currentStep) return "skipped";
    return "pending";
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/20 border-green-500 text-green-400";
      case "current": return "bg-cyan-500/20 border-cyan-500 text-cyan-400 animate-pulse";
      case "pending": return "bg-white/5 border-white/20 text-white/40";
      default: return "bg-white/5 border-white/20 text-white/40";
    }
  };

  const currentStepData = steps.find(s => s.id === currentStep);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif italic text-gold mb-2">Operator Workflow</h2>
          <p className="text-white/70">Follow these steps to close deals and make money</p>
        </div>
        
        {currentStep > 1 && (
          <Button
            onClick={handleUndo}
            variant="outline"
            className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Undo2 className="h-4 w-4" />
            Undo Last Step
          </Button>
        )}
      </div>

      {/* Step Progress Bar */}
      <div className="grid grid-cols-4 gap-4">
        {steps.map((step) => {
          const status = getStepStatus(step);
          return (
            <Card
              key={step.id}
              className={`${getStepColor(status)} border-2 transition-all cursor-pointer hover:scale-105`}
              onClick={() => !step.completed && setCurrentStep(step.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-4xl font-bold">
                    {step.completed ? (
                      <CheckCircle2 className="h-10 w-10 text-green-400" />
                    ) : status === "current" ? (
                      <Circle className="h-10 w-10 fill-cyan-400 text-cyan-400" />
                    ) : (
                      <Circle className="h-10 w-10" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-mono">STEP {step.id}</div>
                    <div className="font-semibold">{step.title}</div>
                  </div>
                </div>
                
                {status === "completed" && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    ✓ Done
                  </Badge>
                )}
                {status === "current" && (
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse">
                    → Current
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Current Step Details */}
      {currentStepData && (
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-sm font-mono text-cyan-400 mb-2">CURRENT STEP</div>
                <h3 className="text-4xl font-bold text-white mb-3">
                  {currentStepData.title}
                </h3>
                <p className="text-xl text-white/70">{currentStepData.description}</p>
              </div>
              
              <div className="text-6xl font-bold text-cyan-400">
                {currentStep}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {currentStep === 1 && (
                <Button
                  onClick={() => window.location.href = "/command-center"}
                  size="lg"
                  className="text-2xl px-12 py-8 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold"
                >
                  <ArrowRight className="h-8 w-8 mr-3" />
                  Go to Business Scraper
                </Button>
              )}
              
              {currentStep === 2 && (
                <Button
                  onClick={() => window.location.href = "/leads"}
                  size="lg"
                  className="text-2xl px-12 py-8 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold"
                >
                  <ArrowRight className="h-8 w-8 mr-3" />
                  Review Qualified Leads
                </Button>
              )}
              
              {currentStep === 3 && (
                <Button
                  onClick={() => window.location.href = "/leads"}
                  size="lg"
                  className="text-2xl px-12 py-8 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold"
                >
                  <ArrowRight className="h-8 w-8 mr-3" />
                  Send Invoices to Leads
                </Button>
              )}
              
              {currentStep === 4 && (
                <Button
                  onClick={() => window.location.href = "/revenue"}
                  size="lg"
                  className="text-2xl px-12 py-8 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
                >
                  <ArrowRight className="h-8 w-8 mr-3" />
                  View Revenue Dashboard
                </Button>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-cyan-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-white mb-1">What to do:</div>
                  <div className="text-white/70">
                    {currentStep === 1 && "Click the button above to open the Business Scraper. Enter a city and business type (e.g., 'pizza restaurant Reno NV'), then click 'Start Scraping'. Wait for it to finish finding businesses."}
                    {currentStep === 2 && "Click the button above to see all leads with bad websites (prestige score 60+). Review the audit reports and pick the best targets."}
                    {currentStep === 3 && "Open a lead detail page, choose a package (Basic/Standard/Premium), and click 'Send Invoice'. The payment link will be copied automatically - paste it in your email or text."}
                    {currentStep === 4 && "Check your revenue dashboard to see how much money you've made. Celebrate your wins!"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
