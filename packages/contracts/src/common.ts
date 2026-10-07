import { z } from 'zod';

/** Mongo ObjectId rendered as its 24-char hex string. */
export const ObjectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'must be a 24-character hex ObjectId');

/**
 * Every persisted document is scoped to a tenant. This is enforced at three
 * layers: the DTO (here), `TenantGuard`, and the Mongoose tenant plugin.
 */
export const TenantIdSchema = z.string().min(1).max(128);

/**
 * A URL the crawler is allowed to fetch.
 *
 * Plain `z.string().url()` also accepts `file://`, `gopher://` and friends,
 * which turns any user-supplied crawl target into an SSRF primitive.
 *
 * The scheme check is a `.regex()` and the structural check is a `.refine()`
 * on purpose. Only the regex survives the trip to JSON Schema, so it is the
 * one that reaches the generated Pydantic models and gives the engine its own
 * enforcement; `.url()` would instead emit `format: "uri"`, which makes
 * datamodel-code-generator pick `AnyUrl` and silently drop the pattern.
 *
 * NOTE: this constrains the scheme only. It does NOT stop a public hostname
 * resolving to a private address — see SECURITY.md, "SSRF".
 */
export const HttpUrlSchema = z
  .string()
  .regex(/^https?:\/\//i, 'only http:// and https:// URLs are accepted')
  .refine(
    (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'must be a well-formed URL' },
  );

/** ISO-8601 instant. Serialises cleanly to `datetime` on the Python side. */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const TimestampsSchema = z.object({
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  startedAt: IsoDateTimeSchema.nullish(),
  finishedAt: IsoDateTimeSchema.nullish(),
});

export const JobErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  /** Stage the failure came from, e.g. `fetch`, `extract`, `embed`. */
  stage: z.string().nullish(),
  retryable: z.boolean().default(false),
});

export type HttpUrl = z.infer<typeof HttpUrlSchema>;
export type ObjectIdString = z.infer<typeof ObjectIdSchema>;
export type TenantId = z.infer<typeof TenantIdSchema>;
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
export type Timestamps = z.infer<typeof TimestampsSchema>;
export type JobError = z.infer<typeof JobErrorSchema>;
