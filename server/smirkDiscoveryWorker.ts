import { executeClaimedSmirkDiscovery } from "./lib/smirkDiscoveryExecutor";
import { claimNextSmirkDiscovery } from "./lib/smirkDiscoveryStore";

const WORKER_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function runSmirkDiscoveryWorkerOnce(): Promise<boolean> {
  if (running) return false;
  running = true;
  try {
    const claim = await claimNextSmirkDiscovery();
    if (!claim) return false;
    await executeClaimedSmirkDiscovery(claim);
    return true;
  } finally {
    running = false;
  }
}

export function startSmirkDiscoveryWorker(): void {
  if (process.env.ENABLE_SMIRK_DISCOVERY_WORKER !== "true") {
    console.log(
      "[SMIRK Discovery] Worker disabled. Approval and queueing cannot spend until ENABLE_SMIRK_DISCOVERY_WORKER=true."
    );
    return;
  }
  if (timer) return;
  console.log(
    `[SMIRK Discovery] Starting one-job worker at ${WORKER_INTERVAL_MS}ms intervals.`
  );
  runSmirkDiscoveryWorkerOnce().catch(error =>
    console.error("[SMIRK Discovery] Initial worker error:", error)
  );
  timer = setInterval(() => {
    runSmirkDiscoveryWorkerOnce().catch(error =>
      console.error("[SMIRK Discovery] Worker error:", error)
    );
  }, WORKER_INTERVAL_MS);
}

export function stopSmirkDiscoveryWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
