import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { monitorReplies } from "./replyMonitor";
import { processUnclassifiedReplies } from "./intentClassifier";
import { sendDueFollowUps } from "./followUpService";

/**
 * Cron Job Router
 * Endpoints for scheduled autonomous tasks
 */

export const cronRouter = router({
  /**
   * Monitor Gmail for new replies
   * Run every 5 minutes
   */
  monitorReplies: publicProcedure
    .mutation(async () => {
      console.log("[Cron] Starting reply monitoring...");
      const newReplies = await monitorReplies();
      
      // Process intent for each new reply
      if (newReplies.length > 0) {
        console.log(`[Cron] Processing ${newReplies.length} new replies...`);
        await processUnclassifiedReplies();
      }
      
      return {
        success: true,
        repliesFound: newReplies.length,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Send due follow-up emails
   * Run every hour
   */
  sendFollowUps: publicProcedure
    .mutation(async () => {
      console.log("[Cron] Starting follow-up sender...");
      const sentCount = await sendDueFollowUps();
      
      return {
        success: true,
        emailsSent: sentCount,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Run all autonomous tasks (for manual testing)
   */
  runAll: publicProcedure
    .mutation(async () => {
      console.log("[Cron] Running all autonomous tasks...");
      
      // Monitor replies
      const newReplies = await monitorReplies();
      
      // Process intents
      if (newReplies.length > 0) {
        await processUnclassifiedReplies();
      }
      
      // Send follow-ups
      const sentCount = await sendDueFollowUps();
      
      return {
        success: true,
        repliesFound: newReplies.length,
        followUpsSent: sentCount,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Health check
   */
  health: publicProcedure
    .query(() => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
          replyMonitor: "active",
          intentClassifier: "active",
          followUpSender: "active",
        },
      };
    }),
});
