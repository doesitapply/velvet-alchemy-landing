import { useState } from "react";
import { Archive, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function Charmer() {
  const [selectedDraft, setSelectedDraft] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const {
    data: drafts,
    isLoading,
    refetch,
  } = trpc.charmer.listDrafts.useQuery();
  const rejectMutation = trpc.charmer.rejectDraft.useMutation({
    onSuccess: () => {
      toast.success("Legacy draft rejected");
      setSelectedDraft(null);
      setRejectionReason("");
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container max-w-6xl space-y-6">
        <header>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-3xl font-bold">Legacy Draft Archive</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Historical Velvet drafts are read-only. SMIRK owns new copy,
            deterministic QC, approval, and delivery records.
          </p>
        </header>

        <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          No draft generation, approval, copy, or send action is available from
          this archive.
        </div>

        {!drafts || drafts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No historical drafts.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {drafts.map(item => {
              const { draft, campaign, lead } = item;
              if (!draft || !campaign || !lead) return null;
              const rejectable = ["pending_approval", "approved"].includes(
                draft.status
              );
              return (
                <Card key={draft.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle>{lead.companyName}</CardTitle>
                        <CardDescription>{lead.websiteUrl}</CardDescription>
                      </div>
                      <Badge variant="outline">{draft.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border bg-muted/30 p-4 text-sm">
                      <p className="font-medium">
                        {draft.recipientName || "Contact"} &lt;
                        {draft.recipientEmail}&gt;
                      </p>
                      <p className="mt-3 font-semibold">{draft.subject}</p>
                      <p className="mt-3 whitespace-pre-wrap">{draft.body}</p>
                    </div>
                    {draft.rejectionReason && (
                      <p className="text-sm text-destructive">
                        {draft.rejectionReason}
                      </p>
                    )}
                    {rejectable && selectedDraft !== draft.id && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setSelectedDraft(draft.id)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject legacy draft
                      </Button>
                    )}
                    {selectedDraft === draft.id && (
                      <div className="space-y-3 border p-4">
                        <Textarea
                          value={rejectionReason}
                          onChange={event =>
                            setRejectionReason(event.target.value)
                          }
                          placeholder="Required rejection reason"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={
                              rejectMutation.isPending ||
                              !rejectionReason.trim()
                            }
                            onClick={() =>
                              rejectMutation.mutate({
                                draftId: draft.id,
                                reason: rejectionReason.trim(),
                              })
                            }
                          >
                            Confirm rejection
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDraft(null);
                              setRejectionReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
