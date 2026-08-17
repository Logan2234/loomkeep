import type {
  Domain,
  ImportCommitOverride,
  ImportPlan,
  ImportReport,
  ImportSource,
} from "@loomkeep/shared";

/**
 * DI token collecting every {@link ImportReq} provider into an array, so the
 * generic {@link ImportJobService} can dispatch by id without importing each
 * source concretely. Register sources with `{ provide: IMPORT_SOURCES, ... }`.
 */
export const IMPORT_SOURCES = Symbol("IMPORT_SOURCES");

/** Lets a long-running analyze/commit push progress onto the polled job. */
export interface ProgressReporter {
  /** Set the denominator once the total to process is known. */
  setTotal(total: number): void;
  /** Advance the numerator by one processed item. */
  tick(): void;
}

/** The user's reconciliation decisions, resolved for a source's `commit`. */
export interface CommitDecisions {
  /** Plan keys the user chose to import. */
  include: Set<string>;
  /** Per-key status choice (domain enum value), for sources with a status control. */
  statuses: Map<string, string>;
  /** Manual matches for items the analysis left unresolved. */
  overrides: Map<string, ImportCommitOverride>;
  /** Wipe the domain's library before writing (already gated on `supportsOverwrite`). */
  overwrite: boolean;
}

/**
 * A user-data source pluggable into the generic import framework. A source owns
 * only its parse/resolve/write; the job lifecycle, polling, progress and the
 * wire DTOs are handled once by {@link ImportJobService}.
 *
 * Generic over `TParsed` — the source's own parse model, kept on the job
 * between `analyze` and a later `commit`.
 */
export interface ImportReq<TParsed = unknown> {
  /** Stable id, matching the `/import/:id` route segment and the UI descriptor. */
  readonly id: ImportSource;
  /** Which catalogue the manual-match search hits (surfaced in the plan). */
  readonly searchDomain: Domain;
  /** Whether `commit` honours the destructive overwrite flag. */
  readonly supportsOverwrite: boolean;
  /**
   * Env var(s) that must all be set for this source to work at all — its own
   * provider API key/OAuth app, distinct from the app's core catalogue keys
   * (TMDB, Google Books…) every source already depends on implicitly.
   * Omitted when the source needs no config of its own (e.g. TV Time's CSV
   * parsing); {@link ImportJobService.getAvailability} reports it available.
   */
  readonly requiredEnvKeys?: string[];

  /**
   * Parse the raw string input (CSV text, a Steam id, or a base64 ZIP — per the
   * source's input type) into its parse model. Throws on a malformed export so
   * the caller gets an immediate 400.
   */
  parseInput(input: string, options: Record<string, boolean>): TParsed;

  /**
   * Resolve the parsed export against the catalogue and build the review plan.
   * Writes nothing; reports progress so the client's poll shows movement.
   */
  buildPlan(
    userId: string,
    parsed: TParsed,
    progress: ProgressReporter,
  ): Promise<ImportPlan>;

  /**
   * Write the user's kept items (applying manual matches/overrides) and return
   * the completion report. Reports progress the same way.
   */
  commit(
    userId: string,
    parsed: TParsed,
    plan: ImportPlan,
    decisions: CommitDecisions,
    progress: ProgressReporter,
  ): Promise<ImportReport>;
}
