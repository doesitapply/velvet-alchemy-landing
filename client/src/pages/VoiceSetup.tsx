import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

export default function VoiceSetup() {
  const [, setLocation] = useLocation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: voiceProfile, isLoading } = trpc.outreach.getVoiceProfile.useQuery();
  
  const initMutation = trpc.outreach.initializeVoiceProfile.useMutation({
    onSuccess: () => {
      toast.success("Voice profile created! AI will now match your writing style.");
      setLocation("/outreach-approval");
    },
    onError: (error) => {
      toast.error(`Failed to analyze voice: ${error.message}`);
      setIsAnalyzing(false);
    },
  });

  const handleAnalyzeFromGmail = async () => {
    setIsAnalyzing(true);
    
    // TODO: Fetch sent emails from Gmail MCP
    // For now, show a message that Gmail integration is needed
    toast.error("Gmail integration not yet connected. Please add sample emails manually.");
    setIsAnalyzing(false);
  };

  const handleManualSamples = () => {
    // TODO: Show form to paste email samples
    toast.info("Manual email input coming soon. Use Gmail import for now.");
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (voiceProfile) {
    return (
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <CardTitle>Voice Profile Active</CardTitle>
                <CardDescription>AI is calibrated to match your writing style</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Formality</div>
                <div className="text-lg font-semibold capitalize">{voiceProfile.formality}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Directness</div>
                <div className="text-lg font-semibold capitalize">{voiceProfile.directness}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Enthusiasm</div>
                <div className="text-lg font-semibold capitalize">{voiceProfile.enthusiasm}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Calibration</div>
                <div className="text-lg font-semibold">
                  {voiceProfile.calibrationCount}/5 emails
                  {voiceProfile.isCalibrated && " ✓"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Common Phrases</div>
              <div className="flex flex-wrap gap-2">
                {voiceProfile.commonPhrases.map((phrase: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-muted rounded-md text-sm">
                    "{phrase}"
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Sign-off Style</div>
              <div className="text-lg">"{voiceProfile.signOffStyle}"</div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={() => setLocation("/outreach-approval")}>
                Go to Approval Queue
              </Button>
              <Button
                variant="outline"
                className="ml-3"
                onClick={handleAnalyzeFromGmail}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Re-analyze from Gmail
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Voice Profile Setup</h1>
        <p className="text-muted-foreground">
          Train the AI to write emails in your voice by analyzing your past emails
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Mail className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Import from Gmail</CardTitle>
            <CardDescription>
              Analyze your sent emails to learn your writing style automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleAnalyzeFromGmail}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              We'll analyze 10-20 of your most recent sent emails to extract your tone, vocabulary, and style.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Sparkles className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Manual Samples</CardTitle>
            <CardDescription>
              Paste 3-5 example emails you've written
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleManualSamples}
              variant="outline"
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Add Samples Manually
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Copy/paste emails from your sent folder if you prefer not to connect Gmail.
            </p>
          </CardContent>
        </Card>
      </div>

      <Alert className="mt-6">
        <AlertDescription>
          <strong>How it works:</strong> The AI analyzes your emails to learn your formality level, directness, enthusiasm, common phrases, and sentence structure. After reviewing 5 AI-generated emails, the system will be fully calibrated to your voice.
        </AlertDescription>
      </Alert>
    </div>
  );
}
