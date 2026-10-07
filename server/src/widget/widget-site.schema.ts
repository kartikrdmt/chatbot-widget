import { WidgetPositionSchema } from '@myra/contracts';
import { z } from 'zod';

const OriginSchema = z.string().refine(
  (value) => {
    try {
      return new URL(value).origin === value;
    } catch {
      return false;
    }
  },
  {
    message:
      'must be an origin such as https://example.com, with no path or trailing slash',
  },
);

export const WidgetSiteSchema = z.object({
  key: z.string().min(1),
  allowedOrigins: z.array(OriginSchema).min(1),
  position: WidgetPositionSchema.optional(),
});

export const WidgetSitesSchema = z
  .array(WidgetSiteSchema)
  .refine(
    (sites) => new Set(sites.map((site) => site.key)).size === sites.length,
    {
      message: 'widget site keys must be unique',
    },
  );

export type WidgetSite = z.infer<typeof WidgetSiteSchema>;
