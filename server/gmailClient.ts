import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Gmail MCP Client
 * Wraps manus-mcp-cli for Gmail operations
 */

export interface GmailMessage {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export interface SentMessage {
  messageId: string;
  threadId: string;
}

/**
 * Send an email via Gmail MCP
 */
export async function sendGmailMessage(message: GmailMessage): Promise<SentMessage> {
  const input = {
    to: message.to,
    subject: message.subject,
    body: message.body,
    ...(message.cc && { cc: message.cc }),
    ...(message.bcc && { bcc: message.bcc }),
  };

  const command = `manus-mcp-cli tool call send_email --server gmail --input '${JSON.stringify(input).replace(/'/g, "'\\''")}'`;

  try {
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error("[Gmail MCP] stderr:", stderr);
    }

    // Parse MCP response
    const response = JSON.parse(stdout);
    
    if (response.error) {
      throw new Error(`Gmail MCP error: ${response.error}`);
    }

    // Extract message ID and thread ID from response
    return {
      messageId: response.messageId || response.id || "unknown",
      threadId: response.threadId || response.thread_id || "unknown",
    };
  } catch (error) {
    console.error("[Gmail MCP] Failed to send email:", error);
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get sent emails (for voice analysis)
 */
export async function getSentEmails(maxResults: number = 20): Promise<Array<{
  id: string;
  subject: string;
  body: string;
  to: string;
  date: string;
}>> {
  const input = {
    query: "in:sent",
    maxResults,
  };

  const command = `manus-mcp-cli tool call search_messages --server gmail --input '${JSON.stringify(input).replace(/'/g, "'\\''")}'`;

  try {
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error("[Gmail MCP] stderr:", stderr);
    }

    const response = JSON.parse(stdout);
    
    if (response.error) {
      throw new Error(`Gmail MCP error: ${response.error}`);
    }

    // Parse messages
    const messages = response.messages || response.content || [];
    return messages.map((msg: any) => ({
      id: msg.id || msg.messageId || "unknown",
      subject: msg.subject || "",
      body: msg.body || msg.snippet || "",
      to: msg.to || "",
      date: msg.date || msg.internalDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[Gmail MCP] Failed to fetch sent emails:", error);
    throw new Error(`Failed to fetch sent emails: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Check for replies to a specific message
 */
export async function checkForReplies(threadId: string): Promise<Array<{
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
}>> {
  const input = {
    threadId,
  };

  const command = `manus-mcp-cli tool call get_thread --server gmail --input '${JSON.stringify(input).replace(/'/g, "'\\''")}'`;

  try {
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error("[Gmail MCP] stderr:", stderr);
    }

    const response = JSON.parse(stdout);
    
    if (response.error) {
      throw new Error(`Gmail MCP error: ${response.error}`);
    }

    // Parse thread messages
    const messages = response.messages || [];
    return messages.map((msg: any) => ({
      id: msg.id || "unknown",
      from: msg.from || "",
      subject: msg.subject || "",
      body: msg.body || msg.snippet || "",
      date: msg.date || msg.internalDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[Gmail MCP] Failed to check for replies:", error);
    return []; // Return empty array if thread not found or error
  }
}

/**
 * Get available Gmail tools (for debugging)
 */
export async function listGmailTools(): Promise<string[]> {
  const command = `manus-mcp-cli tool list --server gmail`;

  try {
    const { stdout } = await execAsync(command);
    const response = JSON.parse(stdout);
    return response.tools || response.content || [];
  } catch (error) {
    console.error("[Gmail MCP] Failed to list tools:", error);
    return [];
  }
}
