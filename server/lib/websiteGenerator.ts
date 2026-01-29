import { invokeAI } from "../aiProvider";

/**
 * AI Website Generator
 * Generates complete HTML/CSS/JS websites from audit data
 */

export interface WebsiteGenerationInput {
  companyName: string;
  websiteUrl: string;
  businessCategory: string;
  prestigeScore: number;
  detailedReport: any;
  auditFindings?: {
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
  };
}

export interface GeneratedWebsite {
  html: string;
  css: string;
  js: string;
  designData: {
    colorPalette: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    typography: {
      headingFont: string;
      bodyFont: string;
    };
    layout: string;
  };
}

/**
 * Generate color palette based on business category
 */
function getIndustryColorPalette(category: string): {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
} {
  const palettes: Record<string, any> = {
    restaurant: {
      primary: "#D32F2F",
      secondary: "#FFA000",
      accent: "#388E3C",
      background: "#FFFFFF",
      text: "#212121",
    },
    hvac: {
      primary: "#1976D2",
      secondary: "#0288D1",
      accent: "#FFA726",
      background: "#FAFAFA",
      text: "#263238",
    },
    plumber: {
      primary: "#0277BD",
      secondary: "#01579B",
      accent: "#FF6F00",
      background: "#FFFFFF",
      text: "#263238",
    },
    electrician: {
      primary: "#F57C00",
      secondary: "#FFB300",
      accent: "#0277BD",
      background: "#FAFAFA",
      text: "#212121",
    },
    roofer: {
      primary: "#5D4037",
      secondary: "#8D6E63",
      accent: "#FF6F00",
      background: "#FFFFFF",
      text: "#212121",
    },
    default: {
      primary: "#1976D2",
      secondary: "#424242",
      accent: "#FF9800",
      background: "#FFFFFF",
      text: "#212121",
    },
  };

  return palettes[category.toLowerCase()] || palettes.default;
}

/**
 * Generate complete website using AI
 */
export async function generateWebsite(
  input: WebsiteGenerationInput
): Promise<GeneratedWebsite> {
  const colorPalette = getIndustryColorPalette(input.businessCategory);
  
  // Extract key information from audit
  const report = input.detailedReport;
  const conversionLeaks = report?.conversion_leaks || [];
  const technicalIssues = report?.technical_audit?.issues || [];
  const suggestedFix = report?.suggested_fix || "";

  // Build prompt for AI
  const prompt = `You are a professional web developer. Generate a modern, mobile-responsive website for a local business.

**Business Information:**
- Company Name: ${input.companyName}
- Category: ${input.businessCategory}
- Current Website: ${input.websiteUrl}
- Prestige Score: ${input.prestigeScore}/100

**Problems to Fix:**
${conversionLeaks.slice(0, 3).map((leak: string) => `- ${leak}`).join('\n')}

**Technical Issues:**
${technicalIssues.slice(0, 3).map((issue: string) => `- ${issue}`).join('\n')}

**Design Requirements:**
- Color Palette: Primary ${colorPalette.primary}, Secondary ${colorPalette.secondary}, Accent ${colorPalette.accent}
- Mobile-first responsive design
- Fast loading (<2s)
- Clear call-to-action buttons
- Contact form with email integration
- Google Maps embed for local business
- Trust signals (reviews, certifications, years in business)

**Sections to Include:**
1. Hero section with clear headline and CTA
2. Services section (list 3-5 main services)
3. About section (brief company story)
4. Contact section with form and map
5. Footer with contact info and social links

Generate ONLY the HTML code. Use inline CSS for styling. Make it production-ready.`;

  console.log('[WebsiteGenerator] Generating website for:', input.companyName);

  const response = await invokeAI({
    messages: [
      {
        role: "system",
        content: "You are an expert web developer who creates beautiful, conversion-optimized websites for local businesses. Output only clean HTML code with inline CSS. No explanations, no markdown code blocks, just raw HTML.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  if (!response.content) {
    throw new Error("No response from LLM");
  }
  
  let htmlContent = response.content;
  
  // Clean up markdown code blocks if AI added them
  htmlContent = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

  // Extract inline CSS to separate file (optional optimization)
  const cssContent = `
/* Generated CSS for ${input.companyName} */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: ${colorPalette.text};
  background: ${colorPalette.background};
}

:root {
  --primary: ${colorPalette.primary};
  --secondary: ${colorPalette.secondary};
  --accent: ${colorPalette.accent};
  --background: ${colorPalette.background};
  --text: ${colorPalette.text};
}
`;

  const jsContent = `
// Contact form submission
document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      alert('Thank you for your message! We will contact you soon.');
      form.reset();
    });
  }
});
`;

  console.log('[WebsiteGenerator] Website generated successfully');

  return {
    html: htmlContent,
    css: cssContent,
    js: jsContent,
    designData: {
      colorPalette,
      typography: {
        headingFont: "system-ui, -apple-system, sans-serif",
        bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      layout: "single-page",
    },
  };
}

/**
 * Save generated website to file system for preview
 */
export function saveWebsiteToFile(
  projectId: number,
  website: GeneratedWebsite
): string {
  const fs = require('fs');
  const path = require('path');
  
  const projectDir = path.join('/tmp', `website-${projectId}`);
  
  // Create project directory
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  
  // Write files
  fs.writeFileSync(path.join(projectDir, 'index.html'), website.html);
  fs.writeFileSync(path.join(projectDir, 'styles.css'), website.css);
  fs.writeFileSync(path.join(projectDir, 'script.js'), website.js);
  
  return projectDir;
}
