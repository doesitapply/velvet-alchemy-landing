import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  ShieldCheck,
} from "lucide-react";

const SCOPE_OPTIONS = [
  {
    value: "leads:read",
    label: "Read Leads",
    description: "GET /leads, GET /leads/:id",
  },
  {
    value: "leads:write",
    label: "Write Leads",
    description: "POST /leads, DELETE /leads/:id",
  },
  {
    value: "scrape",
    label: "Scrape",
    description: "POST /scrape — search businesses",
  },
  { value: "audit", label: "Audit", description: "POST /leads/:id/audit" },
  {
    value: "pipeline",
    label: "Pipeline",
    description: "POST /pipeline — scrape + create + audit",
  },
  {
    value: "smirk:research",
    label: "SMIRK Research",
    description:
      "Export bounded reviewed batches to SMIRK; no contact or spend",
  },
  {
    value: "outcome:write",
    label: "SMIRK Outcome",
    description: "POST /leads/:id/outcome — receive call results",
  },
  {
    value: "*",
    label: "Full Access",
    description: "All current and future scopes",
  },
];

// Preset configs for common integrations
const PRESETS = [
  {
    id: "smirk-research",
    label: "Create research key",
    description:
      "Dedicated reviewed-lead export key; cannot contact prospects or approve spend",
    scopes: ["smirk:research"],
    name: "SMIRK Research Export",
  },
  {
    id: "smirk-outcome",
    label: "Create outcome key",
    description:
      "Separate feedback key for signed outcome callbacks from SMIRK",
    scopes: ["outcome:write"],
    name: "SMIRK Outcome Feedback",
  },
  {
    id: "agent",
    label: "External Agent (read-only)",
    description: "Hermes / OpenClaw — read leads and audit data",
    scopes: ["leads:read"],
    name: "External Agent",
  },
];

export default function ApiKeys() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "leads:read",
  ]);
  const [newKeyResult, setNewKeyResult] = useState<{
    key: string;
    name: string;
    smirkRole?: "research" | "outcome";
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: keys, refetch } = trpc.apiKeys.list.useQuery();
  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: data => {
      const smirkRole =
        data.scopes.length === 1 && data.scopes[0] === "smirk:research"
          ? "research"
          : data.scopes.length === 1 && data.scopes[0] === "outcome:write"
            ? "outcome"
            : undefined;
      setNewKeyResult({ key: data.key, name: data.name, smirkRole });
      setCreateOpen(false);
      setNewKeyName("");
      setSelectedScopes(["leads:read"]);
      refetch();
    },
    onError: err => toast.error(err.message),
  });
  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("Key revoked");
      refetch();
    },
    onError: err => toast.error(err.message),
  });
  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => {
      toast.success("Key deleted");
      refetch();
    },
    onError: err => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) return void toast.error("Name required");
    if (selectedScopes.length === 0)
      return void toast.error("Select at least one scope");
    createMutation.mutate({
      name: newKeyName.trim(),
      scopes: selectedScopes as any[],
    });
  };

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setNewKeyName(preset.name);
    setSelectedScopes(preset.scopes);
    setCreateOpen(true);
  };

  const toggleScope = (scope: string) => {
    if (scope === "*") {
      setSelectedScopes(selectedScopes.includes("*") ? [] : ["*"]);
      return;
    }
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev.filter(s => s !== "*"), scope]
    );
  };

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("Copied");
  };

  const baseUrl = window.location.origin;
  const outcomeWebhookUrl = `${baseUrl}/api/v1/leads/:id/outcome`;
  const researchBatchUrl = `${baseUrl}/api/v1/smirk/lead-batches`;
  const connectionProofUrl = `${baseUrl}/api/v1/smirk/connection-proof`;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            API Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect SMIRK, external agents, and automation tools to your
            pipeline.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                The key will be shown once. Store it securely.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input
                  placeholder="e.g. SMIRK Outcome Webhook"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="space-y-2">
                  {SCOPE_OPTIONS.map(scope => (
                    <div
                      key={scope.value}
                      className="flex items-start gap-3 p-2 rounded border border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleScope(scope.value)}
                    >
                      <Checkbox
                        checked={selectedScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{scope.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {scope.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New key reveal */}
      {newKeyResult && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <CheckCircle className="h-4 w-4" />
              Key Created: {newKeyResult.name}
            </CardTitle>
            <CardDescription className="text-amber-500 font-medium">
              Copy this key now. It will never be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono break-all">
                {newKeyResult.key}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(newKeyResult.key, "new-key")}
                className="shrink-0"
              >
                {copiedKey === "new-key" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {newKeyResult.smirkRole && (
              <div className="rounded border border-violet-500/30 bg-violet-500/10 p-3 text-sm space-y-1">
                <p className="font-medium text-violet-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Private SMIRK variable
                  mapping
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {newKeyResult.smirkRole === "research"
                    ? "VELVET_LEAD_SOURCE_API_KEY"
                    : "VELVET_OUTCOME_API_KEY"}
                  =<span className="text-foreground">{newKeyResult.key}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {newKeyResult.smirkRole === "research"
                    ? "VELVET_LEAD_SOURCE_BASE_URL"
                    : "VELVET_BASE_URL"}
                  =<span className="text-foreground">{baseUrl}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Keep this key separate from the other SMIRK key. Store it in a
                  private 0600 file for the digest-bound SMIRK staging gate.
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setNewKeyResult(null)}
            >
              I've saved it — dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SMIRK credential boundary */}
      <Card className="border-violet-500/40 bg-violet-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-400" />
            SMIRK Connection Credentials
          </CardTitle>
          <CardDescription>
            Create two separate least-privilege keys. This page does not contact
            prospects, enable providers, or deploy either application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Step 1 — Create the two dedicated keys
            </p>
            <p className="text-xs text-muted-foreground">
              The research key can export bounded, reviewed inventory. The
              outcome key can accept signed feedback. Combining the scopes is
              rejected by the remote connection proof.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.filter(preset => preset.id.startsWith("smirk-")).map(
                preset => (
                  <Button
                    key={preset.id}
                    size="sm"
                    variant="outline"
                    className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </Button>
                )
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Step 2 — Stage the exact SMIRK variables
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Use SMIRK's private, digest-bound staging command. Keep every
              execution switch disabled.
            </p>
            <div className="space-y-1.5">
              {[
                {
                  key: "VELVET_LEAD_SOURCE_BASE_URL",
                  value: baseUrl,
                  copyId: "source-base-url",
                },
                {
                  key: "VELVET_BASE_URL",
                  value: baseUrl,
                  copyId: "outcome-base-url",
                },
                {
                  key: "VELVET_LEAD_SOURCE_API_KEY",
                  value: "<research key>",
                  copyId: null,
                },
                {
                  key: "VELVET_OUTCOME_API_KEY",
                  value: "<outcome key>",
                  copyId: null,
                },
                {
                  key: "VELVET_OUTCOME_SIGNING_SECRET",
                  value: "<separate shared HMAC secret>",
                  copyId: null,
                },
                {
                  key: "VELVET_LEAD_SOURCE_WORKSPACE_ID",
                  value: "<exact SMIRK workspace ID>",
                  copyId: null,
                },
                {
                  key: "VELVET_OUTCOME_WORKSPACE_ID",
                  value: "<same exact workspace ID>",
                  copyId: null,
                },
              ].map(row => (
                <div
                  key={row.key}
                  className="flex items-center gap-2 bg-background border border-border rounded px-3 py-1.5"
                >
                  <code className="text-xs text-muted-foreground w-52 shrink-0">
                    {row.key}
                  </code>
                  <code className="text-xs flex-1 text-foreground truncate">
                    {row.value}
                  </code>
                  {row.copyId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyText(row.value, row.copyId!)}
                    >
                      {copiedKey === row.copyId ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Step 3 — Verify both keys without mutation
            </p>
            <p className="text-xs text-muted-foreground">
              SMIRK calls this endpoint once with each key. It verifies exact
              scope, common admin ownership, workspace alignment, and
              signing-secret agreement.
            </p>
            <div className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <code className="text-xs flex-1 text-foreground break-all">
                {connectionProofUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() =>
                  copyText(connectionProofUrl, "connection-proof-url")
                }
              >
                {copiedKey === "connection-proof-url" ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Reviewed research and outcome endpoints
            </p>
            <p className="text-xs text-muted-foreground">
              Research export never authorizes contact or spend. Outcome writes
              require the separate key plus an exact signature.
            </p>
            {[researchBatchUrl, outcomeWebhookUrl].map((url, index) => (
              <div
                key={url}
                className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2"
              >
                <code className="text-xs flex-1 text-foreground break-all">
                  {url}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => copyText(url, `smirk-endpoint-${index}`)}
                >
                  {copiedKey === `smirk-endpoint-${index}` ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Quick Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-muted-foreground">
              Base URL:{" "}
              <code className="bg-muted px-1 rounded">{baseUrl}/api/v1</code>
            </p>
            <p className="text-muted-foreground">
              Auth:{" "}
              <code className="bg-muted px-1 rounded">
                Authorization: Bearer &lt;key&gt;
              </code>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {[
              {
                method: "GET",
                path: "/status",
                desc: "Health check",
                scope: "any",
              },
              {
                method: "GET",
                path: "/leads",
                desc: "List leads",
                scope: "leads:read",
              },
              {
                method: "GET",
                path: "/leads/:id",
                desc: "Get lead + audit",
                scope: "leads:read",
              },
              {
                method: "POST",
                path: "/leads",
                desc: "Create lead",
                scope: "leads:write",
              },
              {
                method: "POST",
                path: "/scrape",
                desc: "Search businesses",
                scope: "scrape",
              },
              {
                method: "POST",
                path: "/leads/:id/audit",
                desc: "Run AI audit",
                scope: "audit",
              },
              {
                method: "POST",
                path: "/pipeline",
                desc: "Scrape + create + audit",
                scope: "pipeline",
              },
              {
                method: "POST",
                path: "/smirk/lead-batches",
                desc: "Reviewed export",
                scope: "smirk:research",
              },
              {
                method: "GET",
                path: "/smirk/connection-proof",
                desc: "No-write proof",
                scope: "exact SMIRK key",
              },
              {
                method: "POST",
                path: "/leads/:id/outcome",
                desc: "Signed outcome",
                scope: "outcome:write",
              },
            ].map(ep => (
              <div
                key={ep.path}
                className="flex items-center gap-2 p-2 bg-muted/40 rounded"
              >
                <Badge
                  variant={ep.method === "GET" ? "secondary" : "default"}
                  className="text-xs w-12 justify-center shrink-0"
                >
                  {ep.method}
                </Badge>
                <code className="text-xs flex-1 truncate">{ep.path}</code>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ep.desc}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Active Keys ({keys?.length ?? 0})
          </h2>
        </div>
        {!keys || keys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No API keys yet. Use the SMIRK Integration panel above or create a
              custom key.
            </CardContent>
          </Card>
        ) : (
          keys.map(key => (
            <Card key={key.id} className={!key.isActive ? "opacity-50" : ""}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{key.name}</span>
                    {!key.isActive && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    )}
                    {(key.scopes as string[]).some(scope =>
                      ["smirk:research", "outcome:write"].includes(scope)
                    ) && (
                      <Badge className="text-xs bg-violet-600/20 text-violet-400 border-violet-500/30">
                        SMIRK
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <code className="text-xs text-muted-foreground">
                      {key.keyPrefix}...
                    </code>
                    <div className="flex gap-1 flex-wrap">
                      {(key.scopes as string[]).map(s => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                    {key.lastUsedAt && (
                      <span>
                        Last used{" "}
                        {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                    {key.expiresAt && (
                      <span>
                        Expires {new Date(key.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {key.isActive && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" /> Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Any app using "{key.name}" will immediately lose
                            access. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              revokeMutation.mutate({ id: key.id })
                            }
                            className="bg-amber-500 hover:bg-amber-600"
                          >
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently delete "{key.name}". This cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: key.id })}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
