import { Link, useRoute } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { getLoginUrl } from "@/const";
import { EmailComposeDialog } from "@/components/EmailComposeDialog";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";

export default function LeadDetailSimple() {
  const [, params] = useRoute("/leads/:id");
  const leadId = params?.id ? parseInt(params.id) : null;
  const { user, loading: authLoading } = useAuth();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const sendDirectEmail = trpc.charmer.sendDirectEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent successfully!");
      setEmailDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  const { data, isLoading, error } = trpc.leads.getById.useQuery(
    { id: leadId! },
    { enabled: !!leadId && !!user }
  );

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="container py-20">
          <Card className="p-8 max-w-md mx-auto text-center space-y-4">
            <h2 className="text-2xl font-serif italic">Login Required</h2>
            <Button asChild className="w-full">
              <a href={getLoginUrl()}>Login</a>
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!leadId || error || !data) {
    return (
      <AppLayout>
        <div className="container py-20">
          <Card className="p-8 max-w-md mx-auto text-center space-y-4">
            <h2 className="text-2xl font-serif italic">Lead Not Found</h2>
            <Button asChild>
              <Link href="/leads">
                <a>Back to Leads</a>
              </Link>
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { lead, audit } = data;

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back Button */}
          <Button asChild variant="ghost" size="sm">
            <Link href="/leads">
              <a className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Leads
              </a>
            </Link>
          </Button>

          {/* Company Header */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-serif italic mb-2">{lead.companyName}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className={`px-2 py-1 rounded-sm font-mono ${
                    lead.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    lead.status === 'audited' ? 'bg-green-500/10 text-green-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {lead.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <Button asChild variant="outline">
                <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  Visit Website
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* Screenshot */}
            {lead.screenshotUrl && (
              <div className="border border-border rounded-sm overflow-hidden">
                <img 
                  src={lead.screenshotUrl} 
                  alt={`Screenshot of ${lead.companyName}`}
                  className="w-full h-auto"
                />
              </div>
            )}
          </Card>

          {/* Audit Score & Summary */}
          {audit && (
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-serif italic mb-4">Website Audit</h2>
                
                {/* Score */}
                {audit.prestigeScore !== null && (
                  <div className="flex items-center gap-6 mb-6">
                    <div className="text-6xl font-serif italic text-gold">{audit.prestigeScore}</div>
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            audit.prestigeScore >= 80 ? 'bg-green-500' :
                            audit.prestigeScore >= 60 ? 'bg-yellow-500' :
                            audit.prestigeScore >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${audit.prestigeScore}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {audit.prestigeScore >= 80 ? 'Exceptional - Minor issues' :
                         audit.prestigeScore >= 60 ? 'Good - Some improvements needed' :
                         audit.prestigeScore >= 40 ? 'Fair - Multiple issues found' :
                         'Poor - Critical problems detected'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Simple Summary */}
                <div className="bg-muted/50 rounded-sm p-4">
                  <h3 className="text-sm font-mono text-muted-foreground mb-2">WHAT'S WRONG</h3>
                  <p className="text-sm leading-relaxed">{audit.summary || "No issues detected"}</p>
                </div>
              </div>

              {/* Send Email Button */}
              <div className="pt-4 border-t border-border">
                <Button 
                  onClick={() => setEmailDialogOpen(true)}
                  className="w-full gap-2 bg-gold text-black hover:bg-gold/90"
                  size="lg"
                >
                  <Mail className="h-5 w-5" />
                  Send Outreach Email
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Click to compose and send an email about these website issues
                </p>
              </div>
            </Card>
          )}

          {/* No Audit Yet */}
          {!audit && (
            <Card className="p-6 text-center space-y-4">
              <h2 className="text-xl font-serif italic">No Audit Available</h2>
              <p className="text-muted-foreground">
                This lead hasn't been audited yet. Ask your admin to run the Orchestrator.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Email Dialog */}
      {audit && (
        <EmailComposeDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          defaultSubject={`Website Audit Results - ${lead.companyName}`}
          defaultBody={`Hi,\n\nI noticed your website ${lead.websiteUrl} has some issues that might be costing you customers.\n\nPrestige Score: ${audit.prestigeScore}/100\n\n${audit.summary}\n\nWe can help fix these problems. Would you like to discuss?\n\nBest regards`}
          onSend={async (data) => {
            await sendDirectEmail.mutateAsync({
              leadId: lead.id,
              to: data.to,
              subject: data.subject,
              body: data.body,
            });
          }}
          isLoading={sendDirectEmail.isPending}
        />
      )}
    </AppLayout>
  );
}
