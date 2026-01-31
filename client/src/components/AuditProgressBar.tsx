import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, XCircle, Sparkles, Binary } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  icon: any;
}

const STAGES: Stage[] = [
  { name: "screenshot", label: "Visual Audit", minProgress: 0, maxProgress: 50, icon: Binary },
  { name: "assets", label: "Generating Assets", minProgress: 50, maxProgress: 80, icon: Sparkles },
  { name: "outreach", label: "Drafting Outreach", minProgress: 80, maxProgress: 100, icon: CheckCircle2 },
];

export function AuditProgressBar({ leadId, onComplete, onError }: AuditProgressBarProps) {
  const [jobId, setJobId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "running" | "completed" | "failed">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const completedJobIdRef = useRef<number | null>(null);

  // Track continuous polling retry count to prevent infinite polling on dead jobs
  const [pollCount, setPollCount] = useState(0);

  const { data: jobs, refetch } = trpc.orchestrator.getJobsForLead.useQuery(
    { leadId },
    {
      // Aggressive polling initially to catch the job creation
      refetchInterval: (query) => {
        const data = query?.state?.data;

        // If no data yet, poll aggressively for first 10 seconds (20 retries)
        if (!data || data.length === 0) {
          return pollCount < 20 ? 1000 : false;
        }

        const latestJob = data[0];

        // Poll if running OR pending
        if (latestJob.status === "running" || latestJob.status === "pending") {
          return 2000;
        }

        return false;
      },
    }
  );

  useEffect(() => {
    // Increment poll count for invalid/empty states
    if (!jobs || jobs.length === 0) {
      setPollCount(prev => prev + 1);
      return;
    }

    const latestJob = jobs.at(0);
    if (!latestJob) return;

    setJobId(latestJob.id);
    // Smooth progress updates could be handled here if we wanted to interpolate
    setProgress(latestJob.progressPercentage || 0);
    setCurrentStage(latestJob.currentStage);
    setStatus(latestJob.status);
    setErrorMessage(latestJob.errorMessage);

    // Call callbacks exactly once
    if (latestJob.status === "completed" && onComplete && completedJobIdRef.current !== latestJob.id) {
      completedJobIdRef.current = latestJob.id;
      setTimeout(() => onComplete(), 1000); // Slight delay for visual satisfaction
    }

    if (latestJob.status === "failed" && onError && latestJob.errorMessage && completedJobIdRef.current !== latestJob.id) {
      completedJobIdRef.current = latestJob.id;
      onError(latestJob.errorMessage);
    }
  }, [jobs, onComplete, onError]);

  // Manually refetch on mount to ensure we don't miss connection
  useEffect(() => {
    refetch();
  }, [refetch]);

  if (!jobId && status === "pending" && pollCount < 20) {
    // Show a "Initializing..." state before the job is officially found
    return (
      <div className="p-6 border border-gold/20 rounded-lg bg-black/40 backdrop-blur-sm animate-pulse">
        <div className="flex items-center gap-3 text-gold">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-serif italic text-lg">Initializing Alchemy Engine...</span>
        </div>
      </div>
    );
  }

  if (!jobId || status === "pending") return null;

  const getStageStatus = (stage: Stage): "completed" | "current" | "pending" | "failed" => {
    if (status === "failed" && currentStage === stage.name) return "failed";
    if (status === "completed") return "completed";
    if (currentStage === stage.name) return "current";
    // Check if we've passed this stage based on progress
    if (progress >= stage.maxProgress) return "completed";
    // If we are in a later stage, this one is completed
    const currentStageIndex = STAGES.findIndex(s => s.name === currentStage);
    const thisStageIndex = STAGES.findIndex(s => s.name === stage.name);
    if (currentStageIndex > thisStageIndex) return "completed";

    return "pending";
  };

  return (
    <div className="space-y-6 p-6 border border-gold/30 rounded-xl bg-gradient-to-br from-black/80 to-zinc-900/80 backdrop-blur-md shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-50" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <h3 className="text-xl font-serif italic text-gold flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Alchemy Process
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            JOB-ID: {jobId ? jobId.toString().padStart(6, '0') : '...'}
          </p>
        </div>
        <span className="text-2xl font-bold text-white font-mono">{progress}%</span>
      </div>

      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-gold to-yellow-600 shimmer-effect"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map((stage) => {
          const stageStatus = getStageStatus(stage);
          const Icon = stage.icon;

          return (
            <div
              key={stage.name}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border transition-all duration-300 relative overflow-hidden group",
                stageStatus === "completed" && "border-green-500/30 bg-green-500/5 text-green-400",
                stageStatus === "current" && "border-gold/50 bg-gold/10 text-gold shadow-[0_0_15px_-3px_rgba(255,215,0,0.2)]",
                stageStatus === "pending" && "border-white/5 bg-white/5 text-muted-foreground",
                stageStatus === "failed" && "border-red-500/50 bg-red-500/10 text-red-500"
              )}
            >
              <div className="relative z-10 flex items-center gap-3">
                {stageStatus === "current" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="h-5 w-5" />
                  </motion.div>
                ) : stageStatus === "completed" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : stageStatus === "failed" ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5 opacity-50" />
                )}

                <div className="flex flex-col">
                  <span className="font-bold text-sm">{stage.label}</span>
                  {stageStatus === "current" && (
                    <span className="text-xs opacity-80 animate-pulse">Processing...</span>
                  )}
                </div>
              </div>

              {/* Active glow */}
              {stageStatus === "current" && (
                <motion.div
                  layoutId="active-glow"
                  className="absolute inset-0 bg-gold/5 z-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {status === "failed" && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm font-mono"
          >
            <strong>Error:</strong> {errorMessage}
          </motion.div>
        )}

        {status === "completed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-lg bg-green-500/10 border border-green-500/50 text-green-400 text-sm flex items-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold">Transformation Complete.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
