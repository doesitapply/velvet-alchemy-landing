import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle, XCircle, Clock, Send } from "lucide-react";

export default function Charmer() {
  const [selectedDraft, setSelectedDraft] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: drafts, isLoading, refetch } = trpc.charmer.listDrafts.useQuery();
  const approveMutation = trpc.charmer.approveDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft approved");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = trpc.charmer.rejectDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft rejected");
      setRejectionReason("");
      setSelectedDraft(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const sendMutation = trpc.charmer.sendDraft.useMutation({
    onSuccess: () => {
      toast.success("Email sent successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to send: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "pending_approval":
        return <Badge variant="default" className="bg-yellow-500">Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-blue-500">Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">The Charmer</h1>
          <p className="text-muted-foreground">
            Review and approve outreach drafts before sending
          </p>
        </div>

        {!drafts || drafts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No drafts yet. Generate a draft from a lead detail page.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {drafts.map((item) => {
              const draft = item.draft;
              const lead = item.lead;
              const campaign = item.campaign;

              if (!draft || !lead || !campaign) return null;

              return (
                <Card key={draft.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{lead.companyName}</CardTitle>
                        <CardDescription className="mt-1">
                          {lead.websiteUrl}
                        </CardDescription>
                      </div>
                      {getStatusBadge(draft.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Email Preview */}
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="mb-3">
                          <p className="text-sm text-muted-foreground">To:</p>
                          <p className="font-medium">
                            {draft.recipientName || "Contact"} &lt;{draft.recipientEmail}&gt;
                          </p>
                        </div>
                        <div className="mb-3">
                          <p className="text-sm text-muted-foreground">Subject:</p>
                          <p className="font-semibold">{draft.subject}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Body:</p>
                          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
                        </div>
                      </div>

                      {/* Rejection Reason (if rejected) */}
                      {draft.status === "rejected" && draft.rejectionReason && (
                        <div className="border border-destructive rounded-lg p-4 bg-destructive/5">
                          <p className="text-sm font-medium text-destructive mb-1">
                            Rejection Reason:
                          </p>
                          <p className="text-sm">{draft.rejectionReason}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        {draft.status === "pending_approval" && (
                          <>
                            <Button
                              onClick={() => approveMutation.mutate({ draftId: draft.id })}
                              disabled={approveMutation.isPending}
                              className="flex-1"
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => setSelectedDraft(draft.id)}
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}

                        {draft.status === "approved" && (
                          <Button
                            onClick={() => sendMutation.mutate({ draftId: draft.id })}
                            disabled={sendMutation.isPending}
                            className="flex-1"
                          >
                            {sendMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Send Email
                          </Button>
                        )}

                        {draft.status === "sent" && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                            Sent on {new Date(draft.sentAt!).toLocaleString()}
                          </div>
                        )}

                        {draft.status === "rejected" && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              // TODO: Implement regenerate functionality
                              toast.info("Regenerate feature coming soon");
                            }}
                            className="flex-1"
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Regenerate
                          </Button>
                        )}
                      </div>

                      {/* Rejection Form */}
                      {selectedDraft === draft.id && (
                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                          <label className="text-sm font-medium">Rejection Reason</label>
                          <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Why is this draft being rejected?"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                if (!rejectionReason.trim()) {
                                  toast.error("Please provide a rejection reason");
                                  return;
                                }
                                rejectMutation.mutate({
                                  draftId: draft.id,
                                  reason: rejectionReason,
                                });
                              }}
                              disabled={rejectMutation.isPending}
                              variant="destructive"
                              size="sm"
                            >
                              {rejectMutation.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              )}
                              Confirm Rejection
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedDraft(null);
                                setRejectionReason("");
                              }}
                              variant="outline"
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
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
