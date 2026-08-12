interface PipelineJobStatus {
  jobId: string;
  step: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  error?: Record<string, any> | null;
}

/** Structural — matches a Vue `Ref<T>` without needing to import the type from 'vue'. */
interface WritableRef<T> {
  value: T;
}

/**
 * Errors thrown here carry `.data` set to the job's structured error payload, so existing catch
 * blocks that read `e?.data?.message` / `e?.data?.gate` (the definition confidence-gate flow)
 * keep working unchanged, whether the failure came from the old synchronous call or this one.
 */
function jobFailedError(status: PipelineJobStatus): Error & { data?: Record<string, any> } {
  const err: Error & { data?: Record<string, any> } = new Error(status.error?.message ?? 'Job failed');
  err.data = status.error ?? { message: err.message };
  return err;
}

async function waitForJob(projectId: number, jobId: string, intervalMs = 2000): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await useApi<PipelineJobStatus | null>(`/projects/${projectId}/jobs/${jobId}`);
    // The server removes a job the instant its terminal state is first read (so retries aren't
    // blocked by a stale completed/failed job sitting on the same id) — a concurrent poller
    // (another tab, or the refresh-resume check racing this one) can win that read first, in
    // which case we just see it vanish. Nothing more to wait for either way.
    if (!status) return;
    if (status.status === 'completed') return;
    if (status.status === 'failed') throw jobFailedError(status);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Enqueues a pipeline step (POST returns immediately with a jobId) and polls until it settles.
 * Callers still re-fetch whatever GET endpoints they need afterward — this only replaces the
 * "wait for the POST to finish" part, not the surrounding refresh logic.
 *
 * `activeStepRef`, if given, is set to the step name for the duration of the job and cleared
 * (success or failure) after — pass the SAME ref from every trigger site (including the
 * resume-after-refresh path) to drive one shared "what's running right now" indicator.
 */
export async function runPipelineJob(
  projectId: number,
  path: string,
  body: Record<string, any> = {},
  activeStepRef?: WritableRef<string | null>,
): Promise<void> {
  const enqueued = await useApi<{ jobId: string; step: string }>(path, { method: 'POST', body });
  if (activeStepRef) activeStepRef.value = enqueued.step;
  try {
    await waitForJob(projectId, enqueued.jobId);
  } finally {
    if (activeStepRef) activeStepRef.value = null;
  }
}

/** The job still running for this project, if any — used to resume polling after a page refresh. */
export async function getActivePipelineJob(projectId: number): Promise<PipelineJobStatus | null> {
  return useApi<PipelineJobStatus | null>(`/projects/${projectId}/jobs/active`).catch(() => null);
}

/** Resolves/rejects exactly like `runPipelineJob`, for resuming a job we already have the id for. */
export async function watchPipelineJob(
  projectId: number,
  jobId: string,
  step: string,
  activeStepRef?: WritableRef<string | null>,
): Promise<void> {
  if (activeStepRef) activeStepRef.value = step;
  try {
    await waitForJob(projectId, jobId);
  } finally {
    if (activeStepRef) activeStepRef.value = null;
  }
}
