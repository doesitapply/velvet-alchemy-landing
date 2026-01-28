import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, CheckCircle, XCircle, Edit, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OutreachApproval() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  const { data: pendingEmails, isLoading, refetch } = trpc.outreach.getPendingEmails.useQuery();
  const { data: voiceProfile } = trpc.outreach.getVoiceProfile.useQuery();
  
  const approveMutation = trpc.outreach.approveEmail.useMutation({
    onSuccess: () => {
      toast.success("Email approved and queued for sending");
      refetch();
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = trpc.outreach.rejectEmail.useMutation({
    onSuccess: () => {
      toast.success("Email rejected");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const handleEdit = (email: any) => {
    setEditingId(email.id);
    setEditedSubject(email.subject);
    setEditedBody(email.body);
  };

  const handleApprove = (emailId: number, sendNow: boolean = true) => {
    if (editingId === emailId) {
      // Send with edits
      approveMutation.mutate({
        emailId,
        subject: editedSubject,
        body: editedBody,
        sendNow,
      });
    } else {
      // Send as-is
      approveMutation.mutate({ emailId, sendNow });
    }
  };

  const handleReject = (emailId: number) => {
    rejectMutation.mutate({ emailId, reason: "Rejected by user" });
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

  const calibrationProgress = voiceProfile?.calibrationCount || 0;
  const isCalibrated = voiceProfile?.isCalibrated || false;

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Approval Queue</h1>
        <p className="text-muted-foreground">
          Review and approve AI-generated outreach emails before they're sent
        </p>
      </div>

      {/* Voice Calibration Status */}
      {voiceProfile && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Voice Calibration:</strong> {calibrationProgress}/5 emails reviewed
                {isCalibrated && (
                  <Badge variant="default" className="ml-2">Calibrated ✓</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Tone: {voiceProfile.formality} · {voiceProfile.directness} · {voiceProfile.enthusiasm}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Emails */}
      {!pendingEmails || pendingEmails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No emails pending approval</h3>
            <p className="text-muted-foreground">
              Generate outreach emails from the Leads page to see them here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingEmails.map((email) => {
            const isEditing = editingId === email.id;

            return (
              <Card key={email.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">
                        {email.companyName}
                      </CardTitle>
                      <CardDescription>
                        To: {email.recipientEmail} · {email.websiteUrl}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Pending Approval</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subject */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Subject</label>
                    {isEditing ? (
                      <Input
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="font-medium"
                      />
                    ) : (
                      <div className="p-3 bg-muted rounded-md font-medium">
                        {email.subject}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email Body</label>
                    {isEditing ? (
                      <Textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <div className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-sm">
                        {email.body}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={() => handleApprove(email.id, true)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Save & Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <div className="text-xs text-muted-foreground ml-auto">
                          Your edits will help train the AI to match your voice
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleApprove(email.id, true)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Approve & Send
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleEdit(email)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit First
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleReject(email.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        {!isCalibrated && (
                          <div className="text-xs text-muted-foreground ml-auto">
                            {5 - calibrationProgress} more approvals to complete calibration
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
