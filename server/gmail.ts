import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Gmail MCP client wrapper for sending emails
 * Uses the manus-mcp-cli to interact with the Gmail MCP server
 */

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Gmail MCP
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  try {
    const input = JSON.stringify({
      to: options.to,
      subject: options.subject,
      body: options.body,
      ...(options.from && { from: options.from }),
    });

    const command = `manus-mcp-cli tool call send_email --server gmail --input '${input.replace(/'/g, "'\\''")}'`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes("OAuth")) {
      console.error("[Gmail MCP] Error:", stderr);
      return {
        success: false,
        error: stderr,
      };
    }

    // Parse the MCP response
    try {
      const response = JSON.parse(stdout);
      return {
        success: true,
        messageId: response.messageId || response.id,
      };
    } catch (parseError) {
      // If we can't parse the response but there's no error, assume success
      if (!stderr || stderr.includes("OAuth")) {
        return {
          success: true,
          messageId: stdout.trim(),
        };
      }
      throw parseError;
    }
  } catch (error) {
    console.error("[Gmail MCP] Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List available Gmail MCP tools
 */
export async function listGmailTools(): Promise<string[]> {
  try {
    const { stdout } = await execAsync("manus-mcp-cli tool list --server gmail");
    const lines = stdout.split("\n").filter((line) => line.trim());
    return lines;
  } catch (error) {
    console.error("[Gmail MCP] Failed to list tools:", error);
    return [];
  }
}
