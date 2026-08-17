import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, CheckCircle, AlertCircle, Clock, Zap, Phone, ExternalLink } from "lucide-react";
import { getApiEndpointKey } from "@shared/apiEndpointKey";
import { OperatorShell } from "@/components/OperatorShell";
import {
  buildSmirkOutcomeContract,
  SMIRK_RAILWAY_BASE_URL,
  SMIRK_RAILWAY_INBOUND_HANDOFF_KEY,
  SMIRK_RAILWAY_OUTCOME_KEY,
  SMIRK_RAILWAY_WORKSPACE_ID,
} from "@shared/smirkIntegrationContract";

const SCOPE_OPTIONS = [
  { value: "leads:read", label: "Read Leads", description: "GET /leads, GET /leads/:id" },
  { value: "leads:write", label: "Write Leads", description: "POST /leads, DELETE /leads/:id" },
  { value: "scrape", label: "Scrape", description: "POST /scrape — search businesses" },
  { value: "audit", label: "Audit", description: "POST /leads/:id/audit" },
  { value: "pipeline", label: "Pipeline", description: "POST /pipeline — scrape + create + audit" },
  { value: "handoff:write", label: "SMIRK Handoff", description: "GET /leads/ready, POST /leads/:id/handoff" },
  { value: "outcome:write", label: "SMIRK Outcome", description: "POST /leads/:id/outcome — receive call results" },
  { value: "*", label: "Full Access", description: "All current and future scopes" },
];

// Preset configs for common integrations
const PRESETS = [
  {
    id: "smirk-outcome",
    label: "SMIRK Outcome Webhook",
    description: "For Railway env var VELVET_ALCHEMY_OUTCOME_KEY — lets SMIRK post call results back",
    scopes: ["outcome:write"],
    name: "SMIRK Outcome Webhook",
  },
  {
    id: "smirk-full",
    label: "SMIRK Full Integration",
    description: "Poll ready leads, trigger handoffs, and receive outcomes",
    scopes: ["handoff:write", "outcome:write"],
    name: "SMIRK Full Integration",
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
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["leads:read"]);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; name: string; isSmirkOutcome?: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: keys, refetch } = trpc.apiKeys.list.useQuery();
  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      const isSmirkOutcome = data.scopes.includes("outcome:write") && !data.scopes.includes("*");
      setNewKeyResult({ key: data.key, name: data.name, isSmirkOutcome });
      setCreateOpen(false);
      setNewKeyName("");
      setSelectedScopes(["leads:read"]);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => { toast.success("Key revoked"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => { toast.success("Key deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) return void toast.error("Name required");
    if (selectedScopes.length === 0) return void toast.error("Select at least one scope");
    createMutation.mutate({ name: newKeyName.trim(), scopes: selectedScopes as any[] });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
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
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev.filter(s => s !== "*"), scope]
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
  const readyLeadsUrl = `${baseUrl}/api/v1/leads/ready`;
  const smirkDiagnosticsUrl = `${baseUrl}/api/v1/integrations/smirk/diagnostics`;
  const smirkOutcomeContract = buildSmirkOutcomeContract(baseUrl);

  return (
    <OperatorShell
      eyebrow="SMIRK CONNECTION"
      title="Integration boundary"
      description="Create narrowly scoped credentials, install the verified callback contract, and inspect receiver diagnostics. This is the security boundary between Velvet’s evidence layer and SMIRK’s calling system."
    >
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            Connection keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect SMIRK and approved operator tooling with the smallest required scope.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New API Key</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>The key will be shown once. Store it securely.</DialogDescription>
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
                        <p className="text-xs text-muted-foreground font-mono">{scope.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
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
                {copiedKey === "new-key" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {newKeyResult.isSmirkOutcome && (
              <div className="rounded border border-violet-500/30 bg-violet-500/10 p-3 text-sm space-y-1">
                <p className="font-medium text-violet-400 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Set this in SMIRK Railway env vars:
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {SMIRK_RAILWAY_OUTCOME_KEY}=<span className="text-foreground">{newKeyResult.key}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  VELVET_ALCHEMY_BASE_URL=<span className="text-foreground">{baseUrl}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  VELVET_ALCHEMY_WORKSPACE_ID=<span className="text-foreground">1</span>
                </p>
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setNewKeyResult(null)}>
              I've saved it — dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SMIRK Integration Panel */}
      <Card className="border-violet-500/40 bg-violet-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-violet-400" />
            SMIRK Integration
          </CardTitle>
          <CardDescription>
            Wire SMIRK to receive call outcomes and post results back to Velvet Alchemy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 1 — Generate an outcome key</p>
            <p className="text-xs text-muted-foreground">
              This key goes into SMIRK's Railway environment. It lets SMIRK post call outcomes back to Velvet Alchemy after each call completes.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={preset.id === "smirk-outcome" ? "default" : "outline"}
                  className={preset.id === "smirk-outcome" ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Step 2 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 2 — Set Railway env vars in SMIRK</p>
            <p className="text-xs text-muted-foreground mb-2">
              In your SMIRK Railway project → Variables, keep the two directions separate:
            </p>
            <div className="space-y-1.5">
              {[
                { key: SMIRK_RAILWAY_OUTCOME_KEY, value: "<outcome:write key from Step 1>", copyId: null },
                { key: SMIRK_RAILWAY_BASE_URL, value: baseUrl, copyId: "base-url" },
                { key: SMIRK_RAILWAY_WORKSPACE_ID, value: "1", copyId: "ws-id" },
              ].map(row => (
                <div key={row.key} className="flex items-center gap-2 bg-background border border-border rounded px-3 py-1.5">
                  <code className="text-xs text-muted-foreground w-52 shrink-0">{row.key}</code>
                  <code className="text-xs flex-1 text-foreground truncate">{row.value}</code>
                  {row.copyId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyText(row.value, row.copyId!)}
                    >
                      {copiedKey === row.copyId
                        ? <CheckCircle className="h-3 w-3 text-green-500" />
                        : <Copy className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <code className="bg-muted px-1 rounded">{SMIRK_RAILWAY_INBOUND_HANDOFF_KEY}</code> is separate: it must match Velvet&apos;s dedicated <code className="bg-muted px-1 rounded">SMIRK_API_KEY</code> for Velvet → SMIRK handoffs. Never place an <code className="bg-muted px-1 rounded">outcome:write</code> key in that variable.
            </p>
          </div>

          <Separator />

          {/* Step 3 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 3 — Outcome webhook URL</p>
            <p className="text-xs text-muted-foreground">
              SMIRK posts to this endpoint after each call. Replace <code className="bg-muted px-1 rounded">:id</code> with the Velvet Alchemy lead ID from the handoff payload.
            </p>
            <div className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <code className="text-xs flex-1 text-foreground break-all">{outcomeWebhookUrl}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => copyText(outcomeWebhookUrl, "outcome-url")}
              >
                {copiedKey === "outcome-url"
                  ? <CheckCircle className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Step 4 — poll ready leads */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 4 — Poll ready leads (optional)</p>
            <p className="text-xs text-muted-foreground">
              If SMIRK or an agent polls Velvet Alchemy for qualified leads, use this endpoint with a <code className="bg-muted px-1 rounded">handoff:write</code> key:
            </p>
            <div className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <code className="text-xs flex-1 text-foreground break-all">{readyLeadsUrl}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => copyText(readyLeadsUrl, "ready-url")}
              >
                {copiedKey === "ready-url"
                  ? <CheckCircle className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Returns audited leads with phone numbers, prestige scores, and pre-built call briefs. Sorted by priority score.
            </p>
          </div>

          <Separator />

          {/* Step 5 — contract + diagnostics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Step 5 — Install the outcome callback contract</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => copyText(smirkOutcomeContract, "outcome-contract")}
              >
                {copiedKey === "outcome-contract" ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                Copy Contract
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into SMIRK’s Velvet callback implementation. The endpoint validates outcome values, numeric workspace binding, lead ownership, and bounded summary length before persisting anything.
            </p>
            <pre className="max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-5 text-foreground whitespace-pre-wrap break-words">{smirkOutcomeContract}</pre>
            <div className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <code className="text-xs flex-1 text-foreground break-all">{smirkDiagnosticsUrl}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => copyText(smirkDiagnosticsUrl, "diagnostics-url")}
              >
                {copiedKey === "diagnostics-url"
                  ? <CheckCircle className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">GET diagnostics</code> with a <code className="bg-muted px-1 rounded">handoff:write</code> key to probe the exact SMIRK receiver route without submitting a handoff or contacting anyone.
            </p>
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
              Base URL: <code className="bg-muted px-1 rounded">{baseUrl}/api/v1</code>
            </p>
            <p className="text-muted-foreground">
              Auth: <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;key&gt;</code>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {[
              { method: "GET", path: "/status", desc: "Health check", scope: "any" },
              { method: "GET", path: "/leads", desc: "List leads", scope: "leads:read" },
              { method: "GET", path: "/leads/:id", desc: "Get lead + audit", scope: "leads:read" },
              { method: "POST", path: "/leads", desc: "Create lead", scope: "leads:write" },
              { method: "POST", path: "/scrape", desc: "Search businesses", scope: "scrape" },
              { method: "POST", path: "/leads/:id/audit", desc: "Run AI audit", scope: "audit" },
              { method: "POST", path: "/pipeline", desc: "Scrape + create + audit", scope: "pipeline" },
              { method: "GET", path: "/integrations/smirk/diagnostics", desc: "Non-contacting receiver probe", scope: "handoff:write" },
              { method: "GET", path: "/leads/ready", desc: "Ready for SMIRK", scope: "handoff:write" },
              { method: "POST", path: "/leads/:id/handoff", desc: "Queue SMIRK call", scope: "handoff:write" },
              { method: "POST", path: "/leads/:id/outcome", desc: "Post call result", scope: "outcome:write" },
            ].map(ep => (
              <div key={getApiEndpointKey(ep)} className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                <Badge
                  variant={ep.method === "GET" ? "secondary" : "default"}
                  className="text-xs w-12 justify-center shrink-0"
                >
                  {ep.method}
                </Badge>
                <code className="text-xs flex-1 truncate">{ep.path}</code>
                <span className="text-xs text-muted-foreground shrink-0">{ep.desc}</span>
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
              No API keys yet. Use the SMIRK Integration panel above or create a custom key.
            </CardContent>
          </Card>
        ) : (
          keys.map(key => (
            <Card key={key.id} className={!key.isActive ? "opacity-50" : ""}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{key.name}</span>
                    {!key.isActive && <Badge variant="destructive" className="text-xs">Revoked</Badge>}
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                    )}
                    {(key.scopes as string[]).includes("outcome:write") && (
                      <Badge className="text-xs bg-violet-600/20 text-violet-400 border-violet-500/30">
                        SMIRK
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <code className="text-xs text-muted-foreground">{key.keyPrefix}...</code>
                    <div className="flex gap-1 flex-wrap">
                      {(key.scopes as string[]).map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                    {key.lastUsedAt && (
                      <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    )}
                    {key.expiresAt && (
                      <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {key.isActive && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10">
                          <AlertCircle className="h-3 w-3 mr-1" /> Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Any app using "{key.name}" will immediately lose access. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => revokeMutation.mutate({ id: key.id })}
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
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently delete "{key.name}". This cannot be undone.
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
    </OperatorShell>
  );
}
