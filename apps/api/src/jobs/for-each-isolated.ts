import type { Logger } from "@nestjs/common";

export interface IsolatedRun {
  /** Items whose `fn` resolved, minus those it answered `false` for (skipped). */
  succeeded: number;
  failed: number;
}

/**
 * Runs `fn` on every item, one failure never stopping the others: it is
 * logged under `label(item)` and counted. A scheduled job looping over
 * accounts used to stop at the first SMTP error or locked row, costing every
 * later account its run.
 *
 * Sequential unless `concurrency` says otherwise.
 */
export async function forEachIsolated<T>(
  items: T[],
  fn: (item: T) => Promise<boolean | void>,
  options: {
    logger: Logger;
    label: (item: T) => string;
    concurrency?: number;
  },
): Promise<IsolatedRun> {
  const run: IsolatedRun = { succeeded: 0, failed: 0 };
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++];

      try {
        if ((await fn(item)) !== false) run.succeeded++;
      } catch (err) {
        run.failed++;
        options.logger.error(`${options.label(item)} failed`, err);
      }
    }
  }

  const workers = Math.max(1, Math.min(options.concurrency ?? 1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return run;
}
