/**
 * Cron utilities: job tracking, logging, circuit breaker, watchdog.
 * All cron route handlers use these helpers for consistent observability.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/types";

/**
 * Record a job run in techanalysis_wb_job_runs.
 */
export async function recordJobRun(
  jobName: string,
  status: JobStatus,
  durationMs: number,
  details: Record<string, unknown> = {}
) {
  try {
    const admin = createAdminClient();
    await admin.from("job_runs").insert({
      job_name: jobName,
      status,
      duration_ms: durationMs,
      details,
      started_at: new Date(Date.now() - durationMs).toISOString(),
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[cron] Failed to record job run for ${jobName}:`, err);
  }
}

/**
 * Log a system event to techanalysis_wb_system_logs.
 */
export async function logSystem(
  category: "crawler" | "email" | "report" | "error" | "system",
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>
) {
  try {
    const admin = createAdminClient();
    await admin.from("system_logs").insert({
      category,
      level,
      message,
      details: details || null,
    });
  } catch (err) {
    console.error(`[cron] Failed to log system event:`, err);
  }
}

/**
 * Verify cron secret from Authorization header.
 * Returns true if valid, false otherwise.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

/**
 * Wrap a cron handler with job tracking and error handling.
 */
export async function withJobTracking<T>(
  jobName: string,
  handler: () => Promise<T>
): Promise<{ result: T; status: JobStatus; durationMs: number }> {
  const start = Date.now();
  try {
    const result = await handler();
    const durationMs = Date.now() - start;
    const status: JobStatus = "success";
    await recordJobRun(jobName, status, durationMs, { ok: true });
    return { result, status, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const status: JobStatus = "failed";
    await recordJobRun(jobName, status, durationMs, {
      error: err instanceof Error ? err.message : String(err),
    });
    await logSystem("error", "error", `Job ${jobName} failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Watchdog: check all tasks in task_registry for overdue execution.
 * A task is overdue if its last successful job_run is older than
 * expected_interval * alert_threshold_multiplier.
 *
 * Returns list of overdue tasks.
 */
export async function runWatchdog(): Promise<
  { job_name: string; owner: string; last_success: string | null; expected_minutes: number; overdue_minutes: number }[]
> {
  const admin = createAdminClient();

  // Get all enabled tasks
  const { data: tasks, error: taskErr } = await admin
    .from("task_registry")
    .select("job_name, owner, expected_interval_minutes, alert_threshold_multiplier")
    .eq("is_enabled", true);

  if (taskErr || !tasks) {
    throw new Error(`Watchdog: failed to fetch task_registry: ${taskErr?.message}`);
  }

  const overdue: {
    job_name: string;
    owner: string;
    last_success: string | null;
    expected_minutes: number;
    overdue_minutes: number;
  }[] = [];

  const now = Date.now();

  for (const task of tasks) {
    const thresholdMs = task.expected_interval_minutes * task.alert_threshold_multiplier * 60 * 1000;

    // Get last successful run for this job
    const { data: lastRun } = await admin
      .from("job_runs")
      .select("started_at, status")
      .eq("job_name", task.job_name)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const lastSuccessAt = lastRun?.started_at || null;
    const lastSuccessMs = lastSuccessAt ? new Date(lastSuccessAt).getTime() : 0;
    const elapsedMs = now - lastSuccessMs;

    if (elapsedMs > thresholdMs) {
      const overdueMinutes = Math.round((elapsedMs - thresholdMs) / 60000);
      overdue.push({
        job_name: task.job_name,
        owner: task.owner,
        last_success: lastSuccessAt,
        expected_minutes: task.expected_interval_minutes,
        overdue_minutes: overdueMinutes,
      });
    }
  }

  if (overdue.length > 0) {
    await logSystem("system", "warn", `Watchdog: ${overdue.length} overdue task(s)`, {
      overdue,
    });
  }

  return overdue;
}
