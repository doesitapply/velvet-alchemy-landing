import AppHeader from "@/components/AppHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Sparkles,
  Mail,
  Zap,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function Help() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-serif italic text-gold mb-2">
            Help & Instructions
          </h1>
          <p className="text-muted-foreground">
            Learn how to use Velvet Alchemy's autonomous revenue engine
          </p>
        </div>

        {/* Quick Start */}
        <Card className="bg-black/50 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-gold">Quick Start (5 Minutes)</CardTitle>
            <CardDescription>
              Get your first lead through the complete pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Create a Lead</h4>
                <p className="text-sm text-muted-foreground">
                  Go to <strong>Leads</strong> → Click{" "}
                  <strong>Create Lead</strong> → Enter company name and website
                  URL
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">Wait for Visual Audit</h4>
                <p className="text-sm text-muted-foreground">
                  The Curator captures a screenshot and generates an AI-powered
                  visual audit (30-60 seconds)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">Generate Assets</h4>
                <p className="text-sm text-muted-foreground">
                  Click <strong>View Details</strong> on the lead → Click{" "}
                  <strong>Generate Assets</strong> to create social posts and
                  banners
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h4 className="font-semibold mb-1">Export Reviewed Evidence</h4>
                <p className="text-sm text-muted-foreground">
                  From Lead Detail, use the admin-only SMIRK research export
                  after the lead and its public evidence have been reviewed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
                5
              </div>
              <div>
                <h4 className="font-semibold mb-1">Draft & Approve in SMIRK</h4>
                <p className="text-sm text-muted-foreground">
                  SMIRK owns deterministic QC, one-recipient approval, and the
                  separate execution confirmation. Velvet cannot draft,
                  approve, send, or dial.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* The Four Agents */}
        <Card className="bg-black/50 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-gold">The Four Agents</CardTitle>
            <CardDescription>
              Understanding the autonomous workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">
                  The Curator
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Captures website screenshots and generates AI-powered visual
                  audits with prestige scores (0-100). Identifies design issues,
                  UX problems, and branding gaps.
                </p>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  ~30-60 seconds per lead
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold text-purple-400 mb-1">
                  The Visionary
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Extracts brand DNA (colors, fonts, vibe) and generates 3
                  social media posts + 1 web banner using AI. Creates
                  professional assets that look like a $10k/month agency made
                  them.
                </p>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  ~2-3 minutes per lead
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold text-green-400 mb-1">
                  Legacy Charmer Archive
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Preserves historical draft records for audit and cleanup.
                  New drafting and approval routes fail closed because SMIRK
                  is the sole outreach authority.
                </p>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Read/reject only
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  The Orchestrator
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Executes the full workflow: Screenshot → Visual Audit → Asset
                  Generation → Outreach Draft. Transforms manual steps into a
                  single autonomous operation. Handles errors and retries
                  automatically.
                </p>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  ~3-5 minutes end-to-end
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="bg-black/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-gold">
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  How long does the visual audit take?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  The Curator typically takes 30-60 seconds to capture a
                  screenshot and generate an AI-powered visual audit. Complex
                  websites with heavy JavaScript may take longer. You'll see the
                  status update in real-time.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  What is a prestige score?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  The prestige score (0-100) measures visual design quality
                  based on typography, color harmony, layout sophistication, and
                  brand consistency. Scores above 80 indicate premium design.
                  Scores below 60 suggest significant visual debt.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  Where do I review new outreach drafts?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  In SMIRK. Velvet exports reviewed evidence but cannot create,
                  approve, or send new outreach. The old Charmer route is a
                  read/reject-only archive.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  What is the Governor?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  The Governor provides safety controls: global kill-switch,
                  per-user rate limits, domain reputation checks, and
                  comprehensive audit logging. Use it to pause all operations,
                  monitor system health, and ensure compliance.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  How do I use the Orchestrator for bulk processing?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  The Orchestrator can process one reviewed lead through
                  research and audit stages. It does not create or send
                  outreach, and bulk autonomous contact is not supported.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  Where are the generated assets stored?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  All generated assets (social posts, banners, screenshots) are
                  stored in S3 and linked in the lead detail page. You can
                  download them individually or view them in the asset gallery.
                  They remain review assets until an operator chooses to use
                  them.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  What email provider does Velvet use?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  None for outreach. Velvet cannot draft, approve, or deliver
                  prospect email. SMIRK owns the guarded provider lane after a
                  reviewed lead is imported.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border-white/10">
                <AccordionTrigger className="text-foreground hover:text-gold">
                  Can I customize the visual audit criteria?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Currently, the visual audit uses a fixed set of criteria
                  optimized for luxury/premium brands. Custom criteria and
                  industry-specific scoring will be available in a future
                  update.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Status Indicators */}
        <Card className="bg-black/50 border-white/10 mt-6">
          <CardHeader>
            <CardTitle className="text-gold">Status Indicators</CardTitle>
            <CardDescription>
              Understanding lead and workflow statuses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                pending
              </Badge>
              <span className="text-sm text-muted-foreground">
                Lead created, waiting for visual audit
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                audited
              </Badge>
              <span className="text-sm text-muted-foreground">
                Visual audit complete, prestige score assigned
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                assets_generated
              </Badge>
              <span className="text-sm text-muted-foreground">
                Social posts and banners created
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                contacted
              </Badge>
              <span className="text-sm text-muted-foreground">
                Outreach email sent successfully
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                failed
              </Badge>
              <span className="text-sm text-muted-foreground">
                Workflow error, check logs for details
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="bg-black/50 border-white/10 mt-6">
          <CardHeader>
            <CardTitle className="text-gold">Best Practices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Target high-value brands</h4>
                <p className="text-sm text-muted-foreground">
                  Focus on luxury, premium, and high-ticket B2B companies. The
                  visual audit is optimized for brands with $1M+ annual revenue.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">
                  Review evidence before export
                </h4>
                <p className="text-sm text-muted-foreground">
                  Confirm source quality, contact classification, and business
                  fit before exporting one lead to SMIRK. No import authorizes
                  contact.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">
                  Use the Orchestrator for bulk processing
                </h4>
                <p className="text-sm text-muted-foreground">
                  Create multiple leads manually, then use the Orchestrator to
                  process them all automatically overnight. This is the most
                  efficient workflow for agencies.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">
                  Monitor the Governor dashboard
                </h4>
                <p className="text-sm text-muted-foreground">
                  Check rate limits and audit logs regularly to ensure
                  compliance and avoid hitting API limits. Use the kill-switch
                  if you need to pause all operations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
