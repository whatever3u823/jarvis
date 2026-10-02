export interface FormState {
  ok: boolean;
  /** One sentence for the whole form. */
  error?: string;
  /** Per-field messages. */
  errors?: Record<string, string>;
  /** What was submitted, so a failed form keeps its contents. */
  values?: Record<string, string>;
  /** Bumped on success so client forms can reset themselves. */
  stamp?: number;
}

export const IDLE: FormState = { ok: false };
