import 'dotenv/config';
import { generateWebsite } from './server/lib/websiteGenerator.ts';
import { getLeadById } from './server/db.ts';

const leadId = 1;
const lead = await getLeadById(leadId);

if (!lead) {
    console.error('Lead not found');
    process.exit(1);
}

const input = {
    companyName: lead.companyName,
    websiteUrl: lead.websiteUrl,
    businessCategory: 'plumber',
    prestigeScore: lead.prestigeScore || 50,
    detailedReport: lead.detailedReport ? JSON.parse(lead.detailedReport) : {},
};

console.log('Generating website...');

try {
    const result = await generateWebsite(input);
    console.log('✅ Website generated successfully!');
    console.log('--- HTML Preview Snippet ---');
    console.log(result.html.substring(0, 500) + '...');
} catch (error) {
    console.error('❌ Generation failed:', error);
}
