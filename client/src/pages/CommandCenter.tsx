import AppHeader from "@/components/AppHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Loader2,
  Play,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { CircularProgress } from "@/components/CircularProgress";
import { ActivityFeed } from "@/components/ActivityFeed";
import { OperatorWizard } from "@/components/OperatorWizard";

export default function CommandCenter() {
  const [isAuditingAll, setIsAuditingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isPreScreening, setIsPreScreening] = useState(false);
  const [sourcingExperimentDraft, setSourcingExperimentDraft] = useState({
    dimension: "category" as "category" | "metro",
    sharedCategory: "plumbing",
    sharedCity: "Reno",
    sharedState: "NV",
    controlValue: "plumbing",
    challengerValue: "hvac",
    controlState: "NV",
    challengerState: "NV",
    workspaceId: 1,
    requestsPerArm: 1,
    leadsPerRequest: 10,
  });

  const metricsQuery = trpc.dashboard.getMetrics.useQuery();
  const pipelineQuery = trpc.dashboard.getPipelineStats.useQuery();
  const activityQuery = trpc.dashboard.getRecentActivity.useQuery();
  const scoreDistQuery = trpc.dashboard.getScoreDistribution.useQuery();
  const categoryLearningQuery = trpc.acquisitionLearning.scorecard.useQuery({
    dimension: "category",
  });
  const metroLearningQuery = trpc.acquisitionLearning.scorecard.useQuery({
    dimension: "metro",
  });
  const learningCandidatesQuery =
    trpc.acquisitionLearning.candidates.useQuery();
  const smirkDiscoveryQuery = trpc.smirkDiscovery.list.useQuery({
    limit: 10,
  });
  const sourcingExperimentsQuery =
    trpc.acquisitionSourcingExperiments.list.useQuery({ limit: 10 });
  const batchAuditMutation = trpc.orchestrator.batchAuditAll.useMutation();
  const prescreenAllMutation = trpc.prescreener.prescreenAll.useMutation();
  const createLearningCandidateMutation =
    trpc.acquisitionLearning.createCandidate.useMutation();
  const decideLearningCandidateMutation =
    trpc.acquisitionLearning.decideCandidate.useMutation();
  const releaseLearningCandidateMutation =
    trpc.acquisitionLearning.releaseCandidate.useMutation();
  const deactivateLearningPolicyMutation =
    trpc.acquisitionLearning.deactivatePolicy.useMutation();
  const approveSmirkDiscoveryMutation =
    trpc.smirkDiscovery.approve.useMutation();
  const executeSmirkDiscoveryMutation =
    trpc.smirkDiscovery.execute.useMutation();
  const rejectSmirkDiscoveryMutation = trpc.smirkDiscovery.reject.useMutation();
  const cancelSmirkDiscoveryMutation = trpc.smirkDiscovery.cancel.useMutation();
  const prepareSourcingExperimentMutation =
    trpc.acquisitionSourcingExperiments.prepare.useMutation();
  const activateSourcingExperimentMutation =
    trpc.acquisitionSourcingExperiments.activate.useMutation();
  const cancelSourcingExperimentMutation =
    trpc.acquisitionSourcingExperiments.cancel.useMutation();
  const closeSourcingExperimentMutation =
    trpc.acquisitionSourcingExperiments.close.useMutation();
  const proposeSourcingCandidateMutation =
    trpc.acquisitionSourcingExperiments.proposeCandidate.useMutation();

  const metrics = metricsQuery.data;
  const pipeline = pipelineQuery.data;
  const activity = activityQuery.data;
  const scoreDist = scoreDistQuery.data;

  const isLoading = metricsQuery.isLoading || pipelineQuery.isLoading;
  const sourcingCapacity =
    sourcingExperimentDraft.requestsPerArm *
    sourcingExperimentDraft.leadsPerRequest *
    2;
  const sourcingPerArm =
    sourcingExperimentDraft.requestsPerArm *
    sourcingExperimentDraft.leadsPerRequest;
  const hasOpenSourcingExperiment = Boolean(
    sourcingExperimentsQuery.data?.some(experiment =>
      ["PREPARED", "ACTIVE"].includes(experiment.state)
    )
  );
  const sourcingDraftValid =
    sourcingPerArm >= 10 &&
    sourcingCapacity <= 40 &&
    sourcingExperimentDraft.workspaceId > 0 &&
    sourcingExperimentDraft.controlValue.trim().length >= 2 &&
    sourcingExperimentDraft.challengerValue.trim().length >= 2 &&
    sourcingExperimentDraft.controlValue.trim().toLowerCase() !==
      sourcingExperimentDraft.challengerValue.trim().toLowerCase() &&
    (sourcingExperimentDraft.dimension === "category"
      ? sourcingExperimentDraft.sharedCity.trim().length > 0 &&
        sourcingExperimentDraft.sharedState.trim().length >= 2
      : sourcingExperimentDraft.sharedCategory.trim().length >= 2 &&
        sourcingExperimentDraft.controlState.trim().length >= 2 &&
        sourcingExperimentDraft.challengerState.trim().length >= 2);

  const createLearningCandidate = async (
    dimension: "category" | "metro",
    value: string
  ) => {
    try {
      await createLearningCandidateMutation.mutateAsync({ dimension, value });
      toast.success("Sourcing candidate recorded for human review.");
      learningCandidatesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The sourcing candidate is not ready."
      );
    }
  };

  const decideLearningCandidate = async (
    id: number,
    decision: "APPROVED" | "REJECTED"
  ) => {
    try {
      await decideLearningCandidateMutation.mutateAsync({ id, decision });
      toast.success(
        `${decision === "APPROVED" ? "Approval" : "Rejection"} recorded. Hunt policy is unchanged.`
      );
      learningCandidatesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to record decision."
      );
    }
  };

  const releaseLearningCandidate = async (
    candidate: NonNullable<
      typeof learningCandidatesQuery.data
    >["candidates"][number]
  ) => {
    const confirmed = confirm(
      "Release this measured sourcing candidate only for future bounded lead research? This does not authorize contact, provider execution, or spend."
    );
    if (!confirmed) return;
    const reason = prompt(
      "Record why this measured segment should guide the next research batch:"
    )?.trim();
    if (!reason) return;
    try {
      await releaseLearningCandidateMutation.mutateAsync({
        candidateId: candidate.id,
        releaseId: crypto.randomUUID(),
        proposalHash: candidate.proposalHash,
        evidenceHash: candidate.evidenceHash,
        confirmation: "release-one-approved-acquisition-candidate-v1",
        attestations: {
          evidenceReviewed: true,
          observationalNotCausal: true,
          noContactOrSpendApproved: true,
        },
        reason,
      });
      toast.success("Sourcing policy released for future research only.");
      learningCandidatesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to release the sourcing policy."
      );
    }
  };

  const deactivateLearningPolicy = async (currentReleaseId: string) => {
    const confirmed = confirm(
      "Deactivate the current learned sourcing policy? Future learned requests will fail closed until another candidate is released."
    );
    if (!confirmed) return;
    const reason = prompt(
      "Record why this sourcing policy is being deactivated:"
    )?.trim();
    if (!reason) return;
    try {
      await deactivateLearningPolicyMutation.mutateAsync({
        currentReleaseId,
        releaseId: crypto.randomUUID(),
        confirmation: "deactivate-current-acquisition-policy-v1",
        reason,
      });
      toast.success("Learned sourcing policy deactivated.");
      learningCandidatesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to deactivate the sourcing policy."
      );
    }
  };

  const prepareSourcingExperiment = async () => {
    const draft = sourcingExperimentDraft;
    const categoryExperiment = draft.dimension === "category";
    const sharedCategory = draft.sharedCategory.trim().toLowerCase();
    const sharedCity = draft.sharedCity.trim();
    const sharedState = draft.sharedState.trim().toUpperCase();
    const controlValue = draft.controlValue.trim();
    const challengerValue = draft.challengerValue.trim();
    try {
      await prepareSourcingExperimentMutation.mutateAsync({
        experimentId: crypto.randomUUID(),
        workspaceId: draft.workspaceId,
        dimension: draft.dimension,
        control: categoryExperiment
          ? {
              label: `${controlValue} in ${sharedCity}`,
              criteria: {
                category: controlValue.toLowerCase(),
                city: sharedCity,
                state: sharedState,
              },
            }
          : {
              label: `${sharedCategory} in ${controlValue}`,
              criteria: {
                category: sharedCategory,
                city: controlValue,
                state: draft.controlState.trim().toUpperCase(),
              },
            },
        challenger: categoryExperiment
          ? {
              label: `${challengerValue} in ${sharedCity}`,
              criteria: {
                category: challengerValue.toLowerCase(),
                city: sharedCity,
                state: sharedState,
              },
            }
          : {
              label: `${sharedCategory} in ${challengerValue}`,
              criteria: {
                category: sharedCategory,
                city: challengerValue,
                state: draft.challengerState.trim().toUpperCase(),
              },
            },
        requestsPerArm: draft.requestsPerArm,
        leadsPerRequest: draft.leadsPerRequest,
        attestNoContactAuthority: true,
        attestNoSpendAuthority: true,
      });
      toast.success(
        "Source experiment prepared. It has no provider, contact, or spend authority."
      );
      sourcingExperimentsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to prepare the source experiment."
      );
    }
  };

  const activateSourcingExperiment = async (
    experiment: NonNullable<typeof sourcingExperimentsQuery.data>[number]
  ) => {
    if (
      !confirm(
        "Activate this frozen two-arm allocation? This prevents operator arm selection but does not execute a provider search, contact anyone, or approve spend."
      )
    ) {
      return;
    }
    try {
      await activateSourcingExperimentMutation.mutateAsync({
        experimentId: experiment.experimentId,
        definitionHash: experiment.definitionHash,
        confirmation: "activate-one-acquisition-sourcing-experiment-v1",
        attestFrozenBalancedAssignment: true,
        attestNoContactAuthority: true,
        attestNoSpendAuthority: true,
      });
      toast.success("Frozen source allocation activated.");
      sourcingExperimentsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to activate the source experiment."
      );
    }
  };

  const cancelSourcingExperiment = async (
    experiment: NonNullable<typeof sourcingExperimentsQuery.data>[number]
  ) => {
    if (
      !confirm(
        `Cancel this ${experiment.state.toLowerCase()} source experiment? Existing assignments and audit history will be preserved; no recommendation will be produced.`
      )
    ) {
      return;
    }
    try {
      await cancelSourcingExperimentMutation.mutateAsync({
        experimentId: experiment.experimentId,
        definitionHash: experiment.definitionHash,
        confirmation: "cancel-one-open-acquisition-sourcing-experiment-v1",
      });
      toast.success(
        "Source experiment cancelled with its audit trail preserved."
      );
      sourcingExperimentsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to cancel the source experiment."
      );
    }
  };

  const closeSourcingExperiment = async (
    experiment: NonNullable<typeof sourcingExperimentsQuery.data>[number]
  ) => {
    if (
      !confirm(
        "Close and evaluate this experiment only after every frozen assignment and canonical outcome is present? A result remains a recommendation and will not change policy."
      )
    ) {
      return;
    }
    try {
      await closeSourcingExperimentMutation.mutateAsync({
        experimentId: experiment.experimentId,
        definitionHash: experiment.definitionHash,
        confirmation: "close-one-acquisition-sourcing-experiment-v1",
        attestAllAssignmentsAndOutcomesReviewed: true,
        attestNoAutomaticPolicyChange: true,
      });
      toast.success(
        "Experiment evaluated. Any recommendation still requires a separate policy decision."
      );
      sourcingExperimentsQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to close the source experiment."
      );
    }
  };

  const proposeSourcingCandidate = async (
    experiment: NonNullable<typeof sourcingExperimentsQuery.data>[number]
  ) => {
    if (
      !experiment.result ||
      experiment.result.status !== "RECOMMENDATION_READY"
    ) {
      return;
    }
    if (
      !confirm(
        "Create one review candidate from this exact closed experiment receipt? It will remain inactive until separately approved and released."
      )
    ) {
      return;
    }
    try {
      await proposeSourcingCandidateMutation.mutateAsync({
        experimentId: experiment.experimentId,
        definitionHash: experiment.definitionHash,
        resultHash: experiment.result.resultHash,
        confirmation: "propose-one-closed-acquisition-sourcing-candidate-v1",
        attestRecommendationReviewed: true,
        attestNoAutomaticPolicyChange: true,
      });
      toast.success(
        "Candidate proposed for review. The sourcing policy is unchanged."
      );
      sourcingExperimentsQuery.refetch();
      learningCandidatesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to propose the experiment candidate."
      );
    }
  };

  const approveSmirkDiscovery = async (
    request: NonNullable<typeof smirkDiscoveryQuery.data>[number]
  ) => {
    const approved = confirm(
      `Approve exactly $${(request.quote.maximumCostCents / 100).toFixed(2)} for this bounded Maps and owner-email research? This approval cannot send email, SMS, or place a call.`
    );
    if (!approved) return;
    try {
      await approveSmirkDiscoveryMutation.mutateAsync({
        discoveryId: request.discoveryId,
        requestPayloadHash: request.requestPayloadHash,
        quotePayloadHash: request.quotePayloadHash,
        approvedMaxSpendCents: request.quote.maximumCostCents,
        confirmation: "approve-one-smirk-discovery-v2",
        attestNoContactAuthority: true,
        attestExactSpendCap: true,
      });
      toast.success("Discovery spend cap approved. Nothing has executed.");
      smirkDiscoveryQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve discovery."
      );
    }
  };

  const executeSmirkDiscovery = async (
    request: NonNullable<typeof smirkDiscoveryQuery.data>[number]
  ) => {
    const approved = confirm(
      "Queue this one approved discovery? The worker may use only the displayed cap and cannot contact a prospect."
    );
    if (!approved) return;
    try {
      await executeSmirkDiscoveryMutation.mutateAsync({
        discoveryId: request.discoveryId,
        requestPayloadHash: request.requestPayloadHash,
        quotePayloadHash: request.quotePayloadHash,
        confirmation: "execute-one-smirk-discovery-v2",
        attestWorkerMayUseApprovedCap: true,
        attestNoContactAuthority: true,
      });
      toast.success("Discovery queued under the approved cap.");
      smirkDiscoveryQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to queue discovery."
      );
    }
  };

  const decideSmirkDiscovery = async (
    request: NonNullable<typeof smirkDiscoveryQuery.data>[number],
    decision: "REJECTED" | "CANCELLED"
  ) => {
    const approved = confirm(
      `${decision === "REJECTED" ? "Reject" : "Cancel"} this discovery request?`
    );
    if (!approved) return;
    try {
      if (decision === "REJECTED") {
        await rejectSmirkDiscoveryMutation.mutateAsync({
          discoveryId: request.discoveryId,
          confirmation: "reject-one-smirk-discovery-v2",
        });
      } else {
        await cancelSmirkDiscoveryMutation.mutateAsync({
          discoveryId: request.discoveryId,
          confirmation: "cancel-one-smirk-discovery-v2",
        });
      }
      toast.success(`Discovery ${decision.toLowerCase()}.`);
      smirkDiscoveryQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update discovery."
      );
    }
  };

  const handlePreScreenAll = async () => {
    if (!metrics?.pendingAudits) return;

    setIsPreScreening(true);
    toast.info(`Pre-screening ${metrics.pendingAudits} leads...`);

    try {
      const result = await prescreenAllMutation.mutateAsync();
      toast.success(
        `Pre-screened ${result.processed} leads! Check Leads page to see priority scores.`
      );
      metricsQuery.refetch();
    } catch (error) {
      toast.error(
        `Pre-screening failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsPreScreening(false);
    }
  };

  const handleAuditAll = async () => {
    if (!metrics?.pendingAudits) return;

    const confirmed = confirm(
      `Start batch audit for all ${metrics.pendingAudits} pending leads? This may take several minutes.`
    );
    if (!confirmed) return;

    setIsAuditingAll(true);
    setBatchProgress({ current: 0, total: metrics.pendingAudits });
    toast.info(`Starting batch audit for ${metrics.pendingAudits} leads...`);

    try {
      await batchAuditMutation.mutateAsync();
      toast.success(`Batch audit completed successfully!`);
      metricsQuery.refetch();
      pipelineQuery.refetch();
    } catch (error) {
      toast.error(
        `Batch audit failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsAuditingAll(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif italic text-gold mb-2">
              Command Center
            </h1>
            <p className="text-muted-foreground">
              Orchestrate your lead generation and outreach operations
            </p>
          </div>

          {/* Operator Wizard */}
          <OperatorWizard />

          <Card className="bg-black/50 border-white/10">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gold">
                    <Target className="h-5 w-5" />
                    Frozen source experiment
                  </CardTitle>
                  <CardDescription>
                    Predeclare two equal sourcing arms, then let SMIRK consume
                    the frozen request slots without operator arm selection.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  Recommendation only
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 border-y border-white/10 py-4 lg:grid-cols-[160px_minmax(0,1fr)_240px]">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Compare
                  </p>
                  <div className="grid grid-cols-2 rounded-md border border-white/10 p-1">
                    {(["category", "metro"] as const).map(dimension => (
                      <Button
                        key={dimension}
                        size="sm"
                        variant={
                          sourcingExperimentDraft.dimension === dimension
                            ? "default"
                            : "ghost"
                        }
                        onClick={() =>
                          setSourcingExperimentDraft(current => ({
                            ...current,
                            dimension,
                            controlValue:
                              dimension === "category" ? "plumbing" : "Reno",
                            challengerValue:
                              dimension === "category" ? "hvac" : "Sacramento",
                          }))
                        }
                      >
                        {dimension === "category" ? "Trade" : "Metro"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {sourcingExperimentDraft.dimension === "category" ? (
                    <>
                      <label className="space-y-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Control trade
                        </span>
                        <Input
                          value={sourcingExperimentDraft.controlValue}
                          onChange={event =>
                            setSourcingExperimentDraft(current => ({
                              ...current,
                              controlValue: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Challenger trade
                        </span>
                        <Input
                          value={sourcingExperimentDraft.challengerValue}
                          onChange={event =>
                            setSourcingExperimentDraft(current => ({
                              ...current,
                              challengerValue: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Fixed city
                        </span>
                        <Input
                          value={sourcingExperimentDraft.sharedCity}
                          onChange={event =>
                            setSourcingExperimentDraft(current => ({
                              ...current,
                              sharedCity: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Fixed state
                        </span>
                        <Input
                          value={sourcingExperimentDraft.sharedState}
                          onChange={event =>
                            setSourcingExperimentDraft(current => ({
                              ...current,
                              sharedState: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="space-y-1.5 text-xs sm:col-span-2">
                        <span className="text-muted-foreground">
                          Fixed trade
                        </span>
                        <Input
                          value={sourcingExperimentDraft.sharedCategory}
                          onChange={event =>
                            setSourcingExperimentDraft(current => ({
                              ...current,
                              sharedCategory: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Control city / state
                        </span>
                        <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                          <Input
                            value={sourcingExperimentDraft.controlValue}
                            onChange={event =>
                              setSourcingExperimentDraft(current => ({
                                ...current,
                                controlValue: event.target.value,
                              }))
                            }
                          />
                          <Input
                            value={sourcingExperimentDraft.controlState}
                            aria-label="Control state"
                            onChange={event =>
                              setSourcingExperimentDraft(current => ({
                                ...current,
                                controlState: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </label>
                      <label className="space-y-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Challenger city / state
                        </span>
                        <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                          <Input
                            value={sourcingExperimentDraft.challengerValue}
                            onChange={event =>
                              setSourcingExperimentDraft(current => ({
                                ...current,
                                challengerValue: event.target.value,
                              }))
                            }
                          />
                          <Input
                            value={sourcingExperimentDraft.challengerState}
                            aria-label="Challenger state"
                            onChange={event =>
                              setSourcingExperimentDraft(current => ({
                                ...current,
                                challengerState: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </label>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      key: "workspaceId",
                      label: "Workspace",
                      min: 1,
                      max: 1_000_000,
                    },
                    {
                      key: "requestsPerArm",
                      label: "Runs / arm",
                      min: 1,
                      max: 10,
                    },
                    {
                      key: "leadsPerRequest",
                      label: "Leads / run",
                      min: 1,
                      max: 20,
                    },
                  ].map(field => (
                    <label key={field.key} className="space-y-1.5 text-xs">
                      <span className="text-muted-foreground">
                        {field.label}
                      </span>
                      <Input
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={
                          sourcingExperimentDraft[
                            field.key as
                              | "workspaceId"
                              | "requestsPerArm"
                              | "leadsPerRequest"
                          ]
                        }
                        onChange={event =>
                          setSourcingExperimentDraft(current => ({
                            ...current,
                            [field.key]: Math.max(
                              field.min,
                              Math.min(
                                field.max,
                                Number(event.target.value) || field.min
                              )
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                  <div className="col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      {sourcingPerArm} requested leads per arm ·{" "}
                      {sourcingCapacity} maximum total
                    </p>
                    <Button
                      size="sm"
                      disabled={
                        !sourcingDraftValid ||
                        hasOpenSourcingExperiment ||
                        prepareSourcingExperimentMutation.isPending
                      }
                      onClick={prepareSourcingExperiment}
                    >
                      {prepareSourcingExperimentMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Target className="mr-2 h-4 w-4" />
                      )}
                      Prepare
                    </Button>
                  </div>
                </div>
              </div>

              {sourcingExperimentsQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : sourcingExperimentsQuery.error ? (
                <p className="text-sm text-red-300">
                  Source experiment ledger unavailable.
                </p>
              ) : !sourcingExperimentsQuery.data?.length ? (
                <p className="text-sm text-muted-foreground">
                  No frozen source experiments have been prepared.
                </p>
              ) : (
                <div className="divide-y divide-white/10 border-y border-white/10">
                  {sourcingExperimentsQuery.data.slice(0, 5).map(experiment => {
                    const busy =
                      activateSourcingExperimentMutation.isPending ||
                      cancelSourcingExperimentMutation.isPending ||
                      closeSourcingExperimentMutation.isPending ||
                      proposeSourcingCandidateMutation.isPending;
                    return (
                      <div
                        key={experiment.experimentId}
                        className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              {experiment.definition.arms.control.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              vs.
                            </span>
                            <span className="text-sm font-semibold">
                              {experiment.definition.arms.challenger.label}
                            </span>
                            <span className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              {experiment.state}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Workspace {experiment.workspaceId} ·{" "}
                            {experiment.assignedRequests}/
                            {experiment.definition.totalRequestSlots} frozen
                            slots assigned · no policy change
                          </p>
                          {experiment.result ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {experiment.result.status} ·{" "}
                              {experiment.result.code}
                              {experiment.result.proposal
                                ? ` · recommends ${experiment.result.proposal.value} for human review`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {experiment.state === "PREPARED" ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                title="Cancel prepared source experiment"
                                disabled={busy}
                                onClick={() =>
                                  cancelSourcingExperiment(experiment)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  activateSourcingExperiment(experiment)
                                }
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Activate allocation
                              </Button>
                            </>
                          ) : null}
                          {experiment.state === "ACTIVE" ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                title="Cancel active source experiment and preserve its audit trail"
                                disabled={busy}
                                onClick={() =>
                                  cancelSourcingExperiment(experiment)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                title="Evaluate only after complete outcome coverage"
                                disabled={busy}
                                onClick={() =>
                                  closeSourcingExperiment(experiment)
                                }
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Evaluate
                              </Button>
                            </>
                          ) : null}
                          {experiment.state === "CLOSED" &&
                          experiment.result?.status ===
                            "RECOMMENDATION_READY" ? (
                            experiment.learningCandidateId ? (
                              <span className="rounded border border-white/10 px-2 py-1 text-xs text-muted-foreground">
                                Candidate #{experiment.learningCandidateId}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  proposeSourcingCandidate(experiment)
                                }
                              >
                                <Target className="mr-2 h-4 w-4" />
                                Propose candidate
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/50 border-white/10">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gold">
                    <Database className="h-5 w-5" />
                    SMIRK discovery approvals
                  </CardTitle>
                  <CardDescription>
                    SMIRK can request a segment and receive a quote. Only this
                    administrator surface can approve cost and queue one bounded
                    Maps and owner-email research job.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  No contact authority
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {smirkDiscoveryQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : smirkDiscoveryQuery.error ? (
                <p className="text-sm text-red-300">
                  Discovery approval ledger unavailable.
                </p>
              ) : !smirkDiscoveryQuery.data?.length ? (
                <p className="text-sm text-muted-foreground">
                  No SMIRK discovery requests are awaiting review.
                </p>
              ) : (
                <div className="divide-y divide-white/10 border-y border-white/10">
                  {smirkDiscoveryQuery.data.map(request => {
                    const busy =
                      approveSmirkDiscoveryMutation.isPending ||
                      executeSmirkDiscoveryMutation.isPending ||
                      rejectSmirkDiscoveryMutation.isPending ||
                      cancelSmirkDiscoveryMutation.isPending;
                    return (
                      <div
                        key={request.discoveryId}
                        className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              {request.effectiveCriteria.category}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {request.effectiveCriteria.city},{" "}
                              {request.effectiveCriteria.state}
                            </span>
                            <span className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              {request.state}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Limit {request.effectiveCriteria.limit}</span>
                            <span className="flex items-center gap-1">
                              <CircleDollarSign className="h-3.5 w-3.5" />
                              Maximum $
                              {(request.quote.maximumCostCents / 100).toFixed(
                                2
                              )}
                            </span>
                            <span>
                              {request.providerRequests}/
                              {request.quote.maximumRequests} provider slots
                            </span>
                            <span>
                              Maps{" "}
                              {request.quote.providers.maps.maximumRequests}
                              /$
                              {(
                                request.quote.providers.maps.maximumCostCents /
                                100
                              ).toFixed(2)}
                            </span>
                            <span>
                              Owner email{" "}
                              {
                                request.quote.providers.ownerEmailEnrichment
                                  .maximumRequests
                              }
                              /$
                              {(
                                request.quote.providers.ownerEmailEnrichment
                                  .maximumCostCents / 100
                              ).toFixed(2)}
                            </span>
                            <span>{request.readyLeadCount} review-ready</span>
                          </div>
                          {request.error ? (
                            <p className="mt-2 text-xs text-red-300">
                              {request.error}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {request.state === "PREPARED" ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                title="Reject discovery request"
                                disabled={busy}
                                onClick={() =>
                                  decideSmirkDiscovery(request, "REJECTED")
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => approveSmirkDiscovery(request)}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Approve cap
                              </Button>
                            </>
                          ) : null}
                          {request.state === "APPROVED" ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                title="Cancel approved discovery"
                                disabled={busy}
                                onClick={() =>
                                  decideSmirkDiscovery(request, "CANCELLED")
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => executeSmirkDiscovery(request)}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Queue one
                              </Button>
                            </>
                          ) : null}
                          {request.state === "QUEUED" ? (
                            <Button
                              size="icon"
                              variant="outline"
                              title="Cancel queued discovery"
                              disabled={busy}
                              onClick={() =>
                                decideSmirkDiscovery(request, "CANCELLED")
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/50 border-white/10">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gold">
                    <Target className="h-5 w-5" />
                    Outcome-linked sourcing
                  </CardTitle>
                  <CardDescription>
                    Signed SMIRK outcomes can propose a bounded next research
                    segment. No hunt, spend, or contact starts here.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  Policy unchanged
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  ["Trade", "category", categoryLearningQuery] as const,
                  ["Metro", "metro", metroLearningQuery] as const,
                ].map(([label, dimension, query]) => (
                  <div
                    key={dimension}
                    className="rounded-lg border border-white/10 bg-black/30 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{label} signals</p>
                        <p className="text-xs text-muted-foreground">
                          {query.data?.sampleSize || 0} unique prospects across{" "}
                          {query.data?.eventCount || 0} measured events
                        </p>
                      </div>
                    </div>
                    {query.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : query.error ? (
                      <p className="text-xs text-red-300">
                        Outcome scorecard unavailable.
                      </p>
                    ) : !query.data?.segments.length ? (
                      <p className="text-xs text-muted-foreground">
                        No scored segments yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {query.data.segments.slice(0, 4).map(segment => (
                          <div
                            key={segment.value}
                            className="flex items-center justify-between gap-3 rounded-md border border-white/5 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {segment.value}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {segment.positive}/{segment.sampleSize} positive
                                · {(segment.positiveRate * 100).toFixed(1)}%
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                segment.sampleSize < 10 ||
                                createLearningCandidateMutation.isPending
                              }
                              onClick={() =>
                                createLearningCandidate(
                                  dimension,
                                  segment.value
                                )
                              }
                            >
                              Propose
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Review candidates</p>
                    <p className="text-xs text-muted-foreground">
                      Decisions are audit facts, not runtime targeting changes.
                    </p>
                  </div>
                </div>
                {learningCandidatesQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : learningCandidatesQuery.error ? (
                  <p className="text-xs text-red-300">
                    Candidate ledger unavailable.
                  </p>
                ) : !learningCandidatesQuery.data?.candidates.length ? (
                  <p className="text-xs text-muted-foreground">
                    No sourcing candidates recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {learningCandidatesQuery.data.candidates
                      .slice(0, 5)
                      .map(candidate => {
                        const proposal = candidate.proposal as {
                          dimension?: string;
                          value?: string;
                          maximumNextBatchSize?: number;
                        };
                        const evidence = candidate.evidence as {
                          oneSidedFisherPValue?: number;
                        };
                        const currentPolicy =
                          learningCandidatesQuery.data?.currentPolicy;
                        const isReleased =
                          currentPolicy?.activeCandidate?.id === candidate.id;
                        return (
                          <div
                            key={candidate.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-3"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {proposal.dimension}: {proposal.value}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Max next batch{" "}
                                {proposal.maximumNextBatchSize || 20} ·{" "}
                                {candidate.sampleSize} prospects · v
                                {candidate.version}
                                {typeof evidence.oneSidedFisherPValue ===
                                "number"
                                  ? ` · Fisher p=${evidence.oneSidedFisherPValue.toFixed(6)}`
                                  : ""}
                              </p>
                            </div>
                            {candidate.state === "CANDIDATE" ? (
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  title="Reject sourcing candidate"
                                  disabled={
                                    decideLearningCandidateMutation.isPending
                                  }
                                  onClick={() =>
                                    decideLearningCandidate(
                                      candidate.id,
                                      "REJECTED"
                                    )
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  title="Approve sourcing candidate record"
                                  disabled={
                                    decideLearningCandidateMutation.isPending
                                  }
                                  onClick={() =>
                                    decideLearningCandidate(
                                      candidate.id,
                                      "APPROVED"
                                    )
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : candidate.state === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="rounded border border-white/10 px-2 py-1 text-xs text-muted-foreground">
                                  {isReleased ? "RELEASED" : "APPROVED"}
                                </span>
                                {isReleased && currentPolicy ? (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    title="Deactivate learned sourcing policy"
                                    disabled={
                                      deactivateLearningPolicyMutation.isPending
                                    }
                                    onClick={() =>
                                      deactivateLearningPolicy(
                                        currentPolicy.releaseId
                                      )
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon"
                                    title="Release for future research"
                                    disabled={
                                      releaseLearningCandidateMutation.isPending
                                    }
                                    onClick={() =>
                                      releaseLearningCandidate(candidate)
                                    }
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="rounded border border-white/10 px-2 py-1 text-xs text-muted-foreground">
                                {candidate.state}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          )}

          {/* Metrics Grid */}
          {!isLoading && metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Leads */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    Total Leads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-400">
                    {metrics.totalLeads}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{metrics.leadsToday} today
                  </p>
                </CardContent>
              </Card>

              {/* Pending Audits */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-yellow-400" />
                    Pending Audits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-400">
                    {metrics.pendingAudits}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Awaiting analysis
                  </p>
                  {metrics.pendingAudits > 0 && (
                    <div className="space-y-2 mt-4">
                      <Button
                        onClick={() => handlePreScreenAll()}
                        disabled={isPreScreening || isAuditingAll}
                        variant="outline"
                        className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        {isPreScreening ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Pre-screening...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Pre-Screen All (Quick)
                          </>
                        )}
                      </Button>
                      <Link href="/leads">
                        <Button
                          variant="outline"
                          className="w-full border-gold/50 text-gold hover:bg-gold/10"
                        >
                          Select Leads to Audit →
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Audits */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Completed Audits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-400">
                    {metrics.completedAudits}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg score: {metrics.avgPrestigeScore}/100
                  </p>
                </CardContent>
              </Card>

              {/* Conversion Rate */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gold" />
                    Conversion Rate
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center pt-4">
                  <CircularProgress
                    value={metrics.conversionRate}
                    size={100}
                    strokeWidth={10}
                    color="#D4AF37"
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    {metrics.withOutreach} outreach sent
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pipeline Funnel */}
          {!isLoading && pipeline && (
            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-gold">Lead Pipeline</CardTitle>
                <CardDescription>
                  Track leads through each stage of the process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Scraped */}
                  <div className="relative">
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">
                        Scraped
                      </div>
                      <div className="text-2xl font-bold text-blue-400">
                        {pipeline.scraped}
                      </div>
                    </div>
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-white/20"></div>
                  </div>

                  {/* Audited */}
                  <div className="relative">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">
                        Audited
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        {pipeline.audited}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.scraped > 0
                          ? Math.round(
                              (pipeline.audited / pipeline.scraped) * 100
                            )
                          : 0}
                        % of total
                      </div>
                    </div>
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-white/20"></div>
                  </div>

                  {/* Assets Generated */}
                  <div className="relative">
                    <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">
                        Assets
                      </div>
                      <div className="text-2xl font-bold text-purple-400">
                        {pipeline.assets}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.audited > 0
                          ? Math.round(
                              (pipeline.assets / pipeline.audited) * 100
                            )
                          : 0}
                        % of audited
                      </div>
                    </div>
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-white/20"></div>
                  </div>

                  {/* Outreach Sent */}
                  <div>
                    <div className="bg-gold/20 border border-gold/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">
                        Outreach
                      </div>
                      <div className="text-2xl font-bold text-gold">
                        {pipeline.outreach}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.assets > 0
                          ? Math.round(
                              (pipeline.outreach / pipeline.assets) * 100
                            )
                          : 0}
                        % of assets
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Run Scraper */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Search className="h-5 w-5" />
                  Business Scraper
                </CardTitle>
                <CardDescription>
                  Find local businesses and bulk-create leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/scraper">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                    <Search className="mr-2 h-4 w-4" />
                    Launch Scraper
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Start Orchestrator */}
            <Card className="bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20 hover:border-gold/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gold">
                  <Play className="h-5 w-5" />
                  Orchestrator
                </CardTitle>
                <CardDescription>
                  Automate the full pipeline for all leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/orchestrator">
                  <Button className="w-full bg-gold hover:bg-gold/90 text-black">
                    <Play className="mr-2 h-4 w-4" />
                    Run Pipeline
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* View Leads */}
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Users className="h-5 w-5" />
                  Manage Leads
                </CardTitle>
                <CardDescription>
                  View, filter, and manage all your leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/leads">
                  <Button className="w-full bg-green-500 hover:bg-green-600 text-white">
                    <Users className="mr-2 h-4 w-4" />
                    View All Leads
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Score Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {!isLoading && activity && (
              <Card className="bg-black/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-gold">Recent Activity</CardTitle>
                  <CardDescription>
                    Latest updates across all leads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activity.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No activity yet. Start by scraping some leads!
                      </p>
                    ) : (
                      activity.map(item => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {item.companyName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.activity}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score Distribution */}
            {!isLoading && scoreDist && (
              <Card className="bg-black/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-gold">
                    Prestige Score Distribution
                  </CardTitle>
                  <CardDescription>
                    Quality breakdown of audited leads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Excellent */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">Excellent (80-100)</span>
                      </div>
                      <span className="text-sm font-semibold text-green-400">
                        {scoreDist.excellent}
                      </span>
                    </div>

                    {/* Good */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm">Good (60-79)</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-400">
                        {scoreDist.good}
                      </span>
                    </div>

                    {/* Fair */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm">Fair (40-59)</span>
                      </div>
                      <span className="text-sm font-semibold text-yellow-400">
                        {scoreDist.fair}
                      </span>
                    </div>

                    {/* Poor */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm">Poor (0-39)</span>
                      </div>
                      <span className="text-sm font-semibold text-red-400">
                        {scoreDist.poor}
                      </span>
                    </div>

                    {scoreDist.excellent +
                      scoreDist.good +
                      scoreDist.fair +
                      scoreDist.poor ===
                      0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No audited leads yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed />
        </div>
      </main>
    </div>
  );
}
