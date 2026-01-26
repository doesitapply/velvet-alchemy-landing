import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getLeadById } from "./db";
import { generateWebsite } from "./lib/websiteGenerator";
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

const WEBSITES_DIR = '/tmp/generated-websites';

// Ensure websites directory exists
if (!fs.existsSync(WEBSITES_DIR)) {
  fs.mkdirSync(WEBSITES_DIR, { recursive: true });
}

export const websiteGeneratorRouter = router({
  /**
   * Generate website from lead audit data
   */
  generate: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get lead details
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (lead.status !== 'audited') {
        throw new Error("Lead must be audited before generating website");
      }

      if (!lead.detailedReport) {
        throw new Error("Lead must have detailed report before generating website");
      }

      // Parse detailed report
      const detailedReport = JSON.parse(lead.detailedReport);

      console.log(`[WebsiteGenerator] Starting generation for lead ${input.leadId}: ${lead.companyName}`);

      // Generate website using AI
      const website = await generateWebsite({
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        businessCategory: 'default', // TODO: Add businessCategory field to leads table
        prestigeScore: lead.prestigeScore || 50,
        detailedReport,
      });

      // Save to filesystem
      const projectDir = path.join(WEBSITES_DIR, `lead-${input.leadId}`);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      // Write files
      fs.writeFileSync(path.join(projectDir, 'index.html'), website.html);
      fs.writeFileSync(path.join(projectDir, 'styles.css'), website.css);
      fs.writeFileSync(path.join(projectDir, 'script.js'), website.js);
      fs.writeFileSync(path.join(projectDir, 'design-data.json'), JSON.stringify(website.designData, null, 2));

      console.log(`[WebsiteGenerator] Website generated successfully at: ${projectDir}`);

      return {
        leadId: input.leadId,
        companyName: lead.companyName,
        status: 'preview',
        designData: website.designData,
        projectPath: projectDir,
      };
    }),

  /**
   * Get website project by lead ID
   */
  getByLeadId: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .query(async ({ input }) => {
      const projectDir = path.join(WEBSITES_DIR, `lead-${input.leadId}`);
      
      if (!fs.existsSync(projectDir)) {
        return null;
      }

      const htmlPath = path.join(projectDir, 'index.html');
      const cssPath = path.join(projectDir, 'styles.css');
      const jsPath = path.join(projectDir, 'script.js');
      const designDataPath = path.join(projectDir, 'design-data.json');

      if (!fs.existsSync(htmlPath)) {
        return null;
      }

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
      const jsContent = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8') : '';
      const designData = fs.existsSync(designDataPath) 
        ? JSON.parse(fs.readFileSync(designDataPath, 'utf-8'))
        : {};

      return {
        leadId: input.leadId,
        htmlContent,
        cssContent,
        jsContent,
        designData,
        projectPath: projectDir,
      };
    }),

  /**
   * Get website preview HTML (combined)
   */
  getPreview: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .query(async ({ input }) => {
      const projectDir = path.join(WEBSITES_DIR, `lead-${input.leadId}`);
      
      if (!fs.existsSync(projectDir)) {
        throw new Error("Website not generated yet");
      }

      const htmlPath = path.join(projectDir, 'index.html');
      const cssPath = path.join(projectDir, 'styles.css');
      const jsPath = path.join(projectDir, 'script.js');

      if (!fs.existsSync(htmlPath)) {
        throw new Error("Website files not found");
      }

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
      const jsContent = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8') : '';

      // Combine into single preview HTML
      const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Preview</title>
  <style>
    ${cssContent}
  </style>
</head>
<body>
  ${htmlContent}
  <script>
    ${jsContent}
  </script>
</body>
</html>
`;

      return {
        html: previewHtml,
      };
    }),

  /**
   * Download website as ZIP file
   */
  downloadZip: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const projectDir = path.join(WEBSITES_DIR, `lead-${input.leadId}`);
      
      if (!fs.existsSync(projectDir)) {
        throw new Error("Website not generated yet");
      }

      const htmlPath = path.join(projectDir, 'index.html');
      if (!fs.existsSync(htmlPath)) {
        throw new Error("Website files not found");
      }

      // Get lead info for filename
      const lead = await getLeadById(input.leadId);
      const companyName = lead?.companyName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || `lead-${input.leadId}`;
      
      // Create ZIP file
      const zipPath = path.join('/tmp', `${companyName}-website.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      return new Promise<{ zipPath: string; filename: string }>((resolve, reject) => {
        output.on('close', () => {
          console.log(`[WebsiteGenerator] ZIP created: ${archive.pointer()} bytes`);
          resolve({
            zipPath,
            filename: `${companyName}-website.zip`,
          });
        });

        archive.on('error', (err) => {
          reject(err);
        });

        archive.pipe(output);

        // Add all files from project directory
        archive.directory(projectDir, false);

        archive.finalize();
      });
    }),
});

