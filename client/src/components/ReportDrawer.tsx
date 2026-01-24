import { X, AlertCircle, TrendingDown, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DetailedReport {
  visual_audit: {
    score: number;
    critique: string;
  };
  technical_audit: {
    load_speed: string;
    mobile_friendly: boolean | null;
  };
  conversion_leaks: string[];
  competitor_analysis: {
    competitor_url: string;
    gap_found: string;
  };
  suggested_fix: string;
}

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  prestigeScore: number;
  detailedReport: DetailedReport | null;
}

function getHealthGrade(score: number): { grade: string; color: string; label: string } {
  if (score >= 90) return { grade: "A", color: "text-green-500", label: "Excellent" };
  if (score >= 80) return { grade: "B", color: "text-blue-500", label: "Good" };
  if (score >= 70) return { grade: "C", color: "text-yellow-500", label: "Fair" };
  if (score >= 60) return { grade: "D", color: "text-orange-500", label: "Poor" };
  return { grade: "F", color: "text-red-500", label: "Critical" };
}

export function ReportDrawer({ isOpen, onClose, companyName, prestigeScore, detailedReport }: ReportDrawerProps) {
  if (!isOpen) return null;

  const healthGrade = getHealthGrade(prestigeScore);
  const report = detailedReport || {
    visual_audit: { score: 0, critique: "No audit data available" },
    technical_audit: { load_speed: "Unknown", mobile_friendly: null },
    conversion_leaks: [],
    competitor_analysis: { competitor_url: "", gap_found: "" },
    suggested_fix: "",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-background border-l border-border z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{companyName}</h2>
            <p className="text-sm text-muted-foreground mt-1">Digital Health Report</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Digital Health Grade */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Digital Health Grade</h3>
                <p className="text-sm text-muted-foreground">{healthGrade.label} - Score: {prestigeScore}/100</p>
              </div>
              <div className={`text-6xl font-bold ${healthGrade.color}`}>
                {healthGrade.grade}
              </div>
            </div>
          </div>

          {/* Visual Audit */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Visual Assessment</h3>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {report.visual_audit.critique || "No visual assessment available"}
              </p>
            </div>
          </div>

          {/* Technical Audit */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Technical Performance</h3>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Load Speed:</span>
                <span className="font-medium">{report.technical_audit.load_speed || "Not measured"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mobile Friendly:</span>
                <span className="font-medium">
                  {report.technical_audit.mobile_friendly === null
                    ? "Not checked"
                    : report.technical_audit.mobile_friendly
                    ? "Yes"
                    : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Conversion Leaks */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold">Revenue Leaks Detected</h3>
            </div>
            {report.conversion_leaks.length > 0 ? (
              <ul className="space-y-2">
                {report.conversion_leaks.map((leak, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-muted-foreground">{leak}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No conversion leaks identified yet</p>
            )}
          </div>

          {/* Competitor Analysis */}
          {report.competitor_analysis.competitor_url && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Competitive Gap Analysis</h3>
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Competitor Reference:</p>
                  <a
                    href={report.competitor_analysis.competitor_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {report.competitor_analysis.competitor_url}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Gap Identified:</p>
                  <p className="text-sm">{report.competitor_analysis.gap_found}</p>
                </div>
              </div>
            </div>
          )}

          {/* Suggested Fix */}
          {report.suggested_fix && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">Recommended Action</h3>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.suggested_fix}
                </p>
              </div>
            </div>
          )}

          {/* Renovation Preview Placeholder */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Renovation Preview</h3>
            <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Visual mockup of improved design will appear here
              </p>
            </div>
          </div>

          {/* Action Button */}
          <Button className="w-full" size="lg">
            Draft Transparent Outreach
          </Button>
        </div>
      </div>
    </>
  );
}
