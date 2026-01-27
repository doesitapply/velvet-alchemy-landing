import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditProgressBarProps {
  leadId: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface Stage {
  name: string;
  label: string;
  minProgress: number;
  maxProgress: number;
}

const STAGES: Stage[] = [
  { name: "screenshot", label: "Screenshot", minProgress: 0, maxProgress: 75 },
  { name: "assets", label: "Assets", minProgress: 75, maxProgress: 90 },
  { name: "outreach", label: "Outreach", minProgress: 90, maxProgress: 100 },
];

export function AuditProgressBar({ leadId, onComplete, onError }: AuditProgressBarProps) {
  const [jobId, setJobId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "running" | "completed" | "failed">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get the latest job for this lead
  const { data: jobs } = trpc.orchestrator.getJobsForLead.useQuery(
    { leadId },
    {
      refetchInterval: (query) => {
        // Stop polling if no jobs exist yet
        const data = query?.state?.data;
        if (!data || !Array.isArray(data) || data.length === 0) {
          return false; // Don't poll if no jobs exist
        }
        
        const latestJob = data[0];
        
        // Only poll if job is actively running
        if (latestJob.status === "running") {
          return 2000; // Poll every 2 seconds while running
        }
        
        // Stop polling for completed, failed, or pending jobs
        return false;
      },
    }
  );

  useEffect(() => {
    if (!jobs || jobs.length === 0) return;

    const latestJob = jobs.at(0); // Most recent job
    if (!latestJob) return;
    setJobId(latestJob.id);
    setProgress(latestJob.progressPercentage || 0);
    setCurrentStage(latestJob.currentStage);
    setStatus(latestJob.status);
    setErrorMessage(latestJob.errorMessage);

    if (latestJob.status === "completed" && onComplete) {
      onComplete();
    }

    if (latestJob.status === "failed" && onError && latestJob.errorMessage) {
      onError(latestJob.errorMessage);
    }
  }, [jobs, onComplete, onError]);

  if (!jobId || status === "pending") {
    return null; // Don't show progress bar until job starts
  }

  const getStageStatus = (stage: Stage): "completed" | "current" | "pending" | "failed" => {
    if (status === "failed" && currentStage === stage.name) return "failed";
    if (status === "completed") return "completed";
    if (currentStage === stage.name) return "current";
    if (progress >= stage.maxProgress) return "completed";
    return "pending";
  };

  return (
    <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Audit Progress</h3>
        <span className="text-sm text-muted-foreground">{progress}%</span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="grid grid-cols-3 gap-4">
        {STAGES.map((stage) => {
          const stageStatus = getStageStatus(stage);
          return (
            <div
              key={stage.name}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border transition-all",
                stageStatus === "completed" && "border-green-500/50 bg-green-500/10",
                stageStatus === "current" && "border-cyan-500/50 bg-cyan-500/10",
                stageStatus === "pending" && "border-border bg-muted/20",
                stageStatus === "failed" && "border-red-500/50 bg-red-500/10"
              )}
            >
              {stageStatus === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
              {stageStatus === "current" && (
                <Loader2 className="h-5 w-5 text-cyan-500 animate-spin flex-shrink-0" />
              )}
              {stageStatus === "pending" && (
                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              {stageStatus === "failed" && (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  stageStatus === "completed" && "text-green-500",
                  stageStatus === "current" && "text-cyan-500",
                  stageStatus === "pending" && "text-muted-foreground",
                  stageStatus === "failed" && "text-red-500"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {status === "failed" && errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50">
          <p className="text-sm text-red-500">
            <strong>Error:</strong> {errorMessage}
          </p>
        </div>
      )}

      {status === "completed" && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/50">
          <p className="text-sm text-green-500">
            <strong>Audit Complete!</strong> All stages finished successfully.
          </p>
        </div>
      )}
    </div>
  );
}
