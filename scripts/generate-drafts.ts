import fs from 'fs';
import path from 'path';

const leadsPath = path.resolve('audit-artifacts/leads_scrape.json');
const leadsData = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'));
const leads = (leadsData.results || []).slice(0, 10);

const drafts: any[] = [];

const variants = [
  {
    id: 'A',
    subject: (lead: any) => `${lead.business_name || lead.domain} | quick revenue leak check`,
    body: (lead: any) => {
      const missing = lead.missing_technologies?.length ? lead.missing_technologies.join(', ') : 'analytics tracking';
      return `Hey ${lead.business_name || lead.domain},\n\nI just ran your site (${lead.domain}) through our lead scanner and noticed you're missing ${missing}. That means ad clicks disappear without ever being retargeted. I already have a patch that adds the tracking + CTA refresh without touching your team. Want to see the before/after?`;
    }
  },
  {
    id: 'B',
    subject: (lead: any) => {
      const score = lead.signal_strength ?? 0;
      return `${lead.business_name || lead.domain} site still looks ${describeScore(score)}?`;
    },
    body: (lead: any) => {
      const score = lead.signal_strength ?? 0;
      return `Hi ${lead.business_name || 'team'},\n\nYour homepage is scoring ${score}/100 in our conversion audit—mostly because the hero has no clear CTA and the contact details are buried. I mocked up a refreshed fold with a sticky booking button if you want to see what a 70+/100 version looks like.`;
    }
  },
  {
    id: 'C',
    subject: (lead: any) => `${lead.business_name || lead.domain} — SSL + intake fix`,
    body: (lead: any) => {
      const ssl = lead.has_broken_ssl ? 'and the SSL certificate is broken' : '';
      return `Hi there,\n\nYour contact form is live but the analytics trail is empty ${ssl ? '(' + ssl + ')' : ''}. I can deploy a patched version with working https + retargeting pixels in 48 hours. If I send over the audit deck, can you take a 5-min look?`;
    }
  }
];

function describeScore(score?: number) {
  if (score === undefined || score === null) return 'dusty';
  if (score < 30) return 'stuck';
  if (score < 60) return 'dated';
  return 'good';
}

let count = 0;
for (const lead of leads) {
  for (const variant of variants) {
    drafts.push({
      variant: variant.id,
      lead: lead.domain,
      subject: variant.subject(lead),
      body: variant.body(lead)
    });
    count++;
  }
}

const outputPath = path.resolve('audit-artifacts/outbound_drafts.json');
fs.writeFileSync(outputPath, JSON.stringify({ timestamp: new Date().toISOString(), drafts }, null, 2));
console.log(`Wrote ${count} drafts to ${outputPath}`);
