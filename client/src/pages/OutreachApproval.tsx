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

export default function OutreachApproval() {
  const {
    data: pendingEmails,
    isLoading,
    refetch,
  } = trpc.outreach.getPendingEmails.useQuery();
  const rejectMutation = trpc.outreach.rejectEmail.useMutation({
    onSuccess: () => {
      toast.success("Legacy queue item rejected");
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <header>
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-3xl font-bold">Legacy Email Queue</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          This queue is retained for cleanup only. New recipient-specific
          drafts and approvals live in SMIRK.
        </p>
      </header>

      <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Velvet cannot approve or send these records.
      </div>

      {!pendingEmails || pendingEmails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No legacy queue items require cleanup.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {pendingEmails.map(email => (
            <Card key={email.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{email.companyName}</CardTitle>
                    <CardDescription>
                      {email.recipientEmail} · {email.websiteUrl}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">legacy pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border bg-muted/30 p-4 text-sm">
                  <p className="font-semibold">{email.subject}</p>
                  <p className="mt-3 whitespace-pre-wrap font-mono">
                    {email.body}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate({
                      emailId: email.id,
                      reason:
                        "Legacy Velvet queue retired; outreach moved to SMIRK QC.",
                    })
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject legacy item
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
