import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, CheckCircle, AlertCircle, Clock, Zap, Phone } from "lucide-react";

const SCOPE_OPTIONS = [
  { value: "leads:read", label: "Read Leads", description: "GET /leads, GET /leads/:id" },
  { value: "leads:write", label: "Write Leads", description: "POST /leads, DELETE /leads/:id" },
  { value: "scrape", label: "Scrape", description: "POST /scrape — search businesses" },
  { value: "audit", label: "Audit", description: "POST /leads/:id/audit" },
  { value: "pipeline", label: "Pipeline", description: "POST /pipeline — scrape + create + audit" },
  { value: "handoff:write", label: "SMIRK Review Handoff", description: "GET /leads/ready; POST /leads/:id/handoff — review only; does not place calls" },
  { value: "*", label: "Full Access", description: "All current and future scopes" },
];

// Preset configs for common integrations
const PRESETS = [
  {
    id: "smirk-handoff",
    label: "SMIRK Review Handoff",
    description: "Poll review-ready leads and create review records; does not authorize or place calls",
    scopes: ["handoff:write"],
    name: "SMIRK Review Handoff",
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
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; name: string; isSmirkHandoff?: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: keys, refetch } = trpc.apiKeys.list.useQuery();
  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      const isSmirkHandoff = data.scopes.includes("handoff:write") && !data.scopes.includes("*");
      setNewKeyResult({ key: data.key, name: data.name, isSmirkHandoff });
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
  const readyLeadsUrl = `${baseUrl}/api/v1/leads/ready`;
  const reviewHandoffUrl = `${baseUrl}/api/v1/leads/:id/handoff`;

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
            Connect SMIRK, external agents, and automation tools to your pipeline.
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
                  placeholder="e.g. SMIRK Review Handoff"
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
            {newKeyResult.isSmirkHandoff && (
              <div className="rounded border border-violet-500/30 bg-violet-500/10 p-3 text-sm space-y-1">
                <p className="font-medium text-violet-400 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Review-handoff key
                </p>
                <p className="text-xs text-muted-foreground">
                  Use this as a Bearer token only for the review-ready and review-handoff endpoints.
                  It does not authorize or place calls.
                </p>
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setNewKeyResult(null)}>
              I've saved it — dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SMIRK review-handoff panel */}
      <Card className="border-violet-500/40 bg-violet-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-violet-400" />
            SMIRK Review Handoff
          </CardTitle>
          <CardDescription>
            Create a narrowly scoped key for review records. This workflow does not authorize or place calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 1 — Generate a review-handoff key</p>
            <p className="text-xs text-muted-foreground">
              The handoff scope can list review-ready leads and create a review record in SMIRK.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={preset.id === "smirk-handoff" ? "default" : "outline"}
                  className={preset.id === "smirk-handoff" ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 2 — Poll review-ready leads</p>
            <p className="text-xs text-muted-foreground">
              Send the scoped key as <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;key&gt;</code>.
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
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 3 — Create the review handoff</p>
            <p className="text-xs text-muted-foreground">
              Replace <code className="bg-muted px-1 rounded">:id</code> with the returned lead ID.
              A successful request creates a review-only SMIRK record; it does not place a call.
            </p>
            <div className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <code className="text-xs flex-1 text-foreground break-all">{reviewHandoffUrl}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => copyText(reviewHandoffUrl, "handoff-url")}
              >
                {copiedKey === "handoff-url"
                  ? <CheckCircle className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </Button>
            </div>
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
              { method: "GET", path: "/leads/ready", desc: "Review-ready leads", scope: "handoff:write" },
              { method: "POST", path: "/leads/:id/handoff", desc: "Create review handoff", scope: "handoff:write" },
            ].map(ep => (
              <div key={ep.path} className="flex items-center gap-2 p-2 bg-muted/40 rounded">
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
                    {(key.scopes as string[]).includes("handoff:write") && (
                      <Badge className="text-xs bg-violet-600/20 text-violet-400 border-violet-500/30">
                        SMIRK review
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
  );
}
