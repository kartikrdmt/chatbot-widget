import { Logger } from '@nestjs/common';
import type { Schema } from 'mongoose';

import { getAmbientTenantContext } from '../services/tenant-context.service.js';

const logger = new Logger('TenantPlugin');

/** Every query hook that can read or modify existing documents. */
const READ_AND_WRITE_HOOKS = [
  'count',
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'estimatedDocumentCount',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
] as const;

export interface TenantPluginOptions {
  /** Field holding the tenant. Defaults to `tenantId`. */
  field?: string;
  /**
   * Throw when a query runs with no tenant in context instead of letting it
   * through unscoped. Leave this on: the failure mode of "off" is a silent
   * cross-tenant read.
   */
  strict?: boolean;
}

/**
 * Mongoose plugin that scopes every query to the tenant in the current request.
 *
 * It adds the tenant field to the schema, injects it into query filters, and
 * stamps it onto new documents. Without this, forgetting one `.find({tenantId})`
 * anywhere in the codebase is a data leak; with it, the default is safe and
 * escaping the scope has to be deliberate (`query.setOptions({ skipTenant: true })`).
 */
export function tenantPlugin(
  schema: Schema,
  options: TenantPluginOptions = {},
): void {
  const field = options.field ?? 'tenantId';
  const strict = options.strict ?? true;

  schema.add({
    [field]: {
      type: String,
      required: true,
      index: true,
    },
  });

  // Tenant-first compound index: every scoped query starts with an equality
  // match on the tenant, which is the ideal prefix for these indexes.
  schema.index({ [field]: 1, createdAt: -1 });

  const resolveTenantId = (operation: string): string | undefined => {
    const context = getAmbientTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId && strict) {
      throw new Error(
        `[tenantPlugin] ${operation} ran with no tenant in context. ` +
          'Either the request bypassed TenantContextMiddleware, or this is a ' +
          'background task that must opt out with { skipTenant: true }.',
      );
    }
    return tenantId;
  };

  // mongoose types pre() as a large overload set keyed on literal hook names;
  // a loop over a union of those names matches none of them. The runtime call
  // is identical, so narrow the signature once here rather than at 13 sites.
  const registerPre = schema.pre.bind(schema) as unknown as (
    hook: string,
    fn: (this: unknown) => void,
  ) => void;

  for (const hook of READ_AND_WRITE_HOOKS) {
    registerPre(hook, function tenantScope(this: unknown) {
      // `this` is a mongoose Query; typed loosely because the hook union does
      // not narrow to a single Query type.
      const query = this as unknown as {
        getOptions: () => Record<string, unknown>;
        getFilter: () => Record<string, unknown>;
        where: (path: string, value: unknown) => unknown;
      };

      if (query.getOptions().skipTenant === true) {
        logger.debug(`${hook}: tenant scoping explicitly skipped`);
        return;
      }

      const tenantId = resolveTenantId(hook);
      if (!tenantId) return;

      // Only set it when absent, so an explicit filter stays authoritative and
      // a caller cannot accidentally be silently rescoped.
      if (query.getFilter()[field] === undefined) {
        query.where(field, tenantId);
      }
    });
  }

  // New documents get stamped on the way in.
  //
  // This has to happen in `validate`, not only `save`: Mongoose checks `required` BEFORE the
  // `save` hooks run, so a document created without an explicit tenantId was rejected as
  // "tenantId is required" and never reached the stamping. (Deviation from the myra-ai original,
  // which only stamped in `save`; its tests call hooks on a fake query, so it never saw this.)
  function stampTenant(this: Record<string, unknown>) {
    if (this[field] !== undefined) return;
    const tenantId = resolveTenantId('save');
    if (tenantId) this[field] = tenantId;
  }
  schema.pre('validate', stampTenant);
  schema.pre('save', stampTenant);

  schema.pre(
    'insertMany',
    function stampMany(next, docs: Record<string, unknown>[]) {
      const tenantId = resolveTenantId('insertMany');
      if (tenantId) {
        for (const doc of docs) {
          doc[field] ??= tenantId;
        }
      }
      next();
    },
  );

  // Serialise as the contract expects: a string `id`, no `_id`/`__v`.
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      return ret;
    },
  });
}
