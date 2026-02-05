import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { analyzeVisualDebt } from '../server/visualAudit';
import { captureScreenshot } from '../server/screenshot';

function bufferToDataUrl(buffer: Buffer, contentType: string) {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function runBatchAudits() {
  const leadsPath = path.resolve('audit-artifacts/leads_scrape.json');
  if (!fs.existsSync(leadsPath)) {
    throw new Error(`Lead scrape artifact not found: ${leadsPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'));
  const leads = raw.results || [];
  const sample = leads.slice(0, 10);

  const results: any[] = [];

  console.log(`Running visual audits for ${sample.length} leads...`);

  for (const lead of sample) {
    const domain: string = lead.domain;
    const companyName: string = lead.business_name || domain;
    const websiteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    console.log(`\n[Audit] ${companyName} (${websiteUrl})`);

    // Avoid third-party screenshot URLs (thum.io often times out). Capture a screenshot
    // ourselves and pass it inline as a data URL so the vision model can always read it.
    const screenshot = await captureScreenshot(websiteUrl, 60000);
    if (!screenshot.success) {
      results.push({
        domain,
        companyName,
        websiteUrl,
        screenshotUrl: null,
        prestigeScore: 50,
        summary: `Audit failed for ${companyName}. Error: Screenshot capture failed: ${screenshot.error || 'unknown error'}`,
        strengths: ["Unable to analyze"],
        weaknesses: ["Screenshot capture failed"],
        visualDebt: [
          {
            category: "technical",
            severity: "high",
            issue: "Screenshot capture failed",
            recommendation: "Retry capture or fall back to manual review",
          },
        ],
      });
      console.log(`   -> Screenshot failed (${screenshot.error || 'unknown error'}); recorded stub result`);
      continue;
    }

    const screenshotUrl = bufferToDataUrl(screenshot.buffer, screenshot.contentType || 'image/png');
    const auditResult = await analyzeVisualDebt(screenshotUrl, websiteUrl, companyName);

    results.push({
      domain,
      companyName,
      websiteUrl,
      screenshotUrl: 'data:image/png;base64,<omitted>',
      prestigeScore: auditResult.prestigeScore,
      summary: auditResult.summary,
      strengths: auditResult.strengths,
      weaknesses: auditResult.weaknesses,
      visualDebt: auditResult.visualDebt,
    });

    console.log(`   -> Score ${auditResult.prestigeScore}`);
  }

  const artifactPath = path.resolve('audit-artifacts/batch_audits.json');
  fs.writeFileSync(artifactPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    leadsProcessed: sample.length,
    results,
  }, null, 2));

  console.log(`\nSaved artifact: ${artifactPath}`);
}

runBatchAudits().catch(err => {
  console.error('Batch audits failed:', err);
  process.exitCode = 1;
});
