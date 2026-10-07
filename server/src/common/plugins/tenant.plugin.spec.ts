import { model, Schema } from 'mongoose';

import {
  setAmbientTenantContext,
  TenantContextService,
} from '../services/tenant-context.service.js';
import { tenantPlugin } from './tenant.plugin.js';

/**
 * These tests run the plugin's hooks directly against a fake query rather than
 * a live Mongo connection: what needs proving is the scoping logic, and a real
 * server would only slow that down.
 */
interface FakeQuery {
  filter: Record<string, unknown>;
  options: Record<string, unknown>;
  getFilter: () => Record<string, unknown>;
  getOptions: () => Record<string, unknown>;
  where: (path: string, value: unknown) => void;
}

const fakeQuery = (
  filter: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
): FakeQuery => {
  const query: FakeQuery = {
    filter,
    options,
    getFilter: () => query.filter,
    getOptions: () => query.options,
    where: (path, value) => {
      query.filter[path] = value;
    },
  };
  return query;
};

/** Pull the plugin's `pre` hook for a given operation off a built schema. */
const hookFor = (
  schema: Schema,
  operation: string,
): ((this: unknown) => void) => {
  const registered = (
    schema as unknown as {
      s: { hooks: { _pres: Map<string, { fn: (this: unknown) => void }[]> } };
    }
  ).s.hooks._pres.get(operation);

  if (!registered?.length)
    throw new Error(`no pre("${operation}") hook registered`);
  return registered[registered.length - 1]!.fn;
};

const buildSchema = (): Schema => {
  const schema = new Schema({ name: String });
  tenantPlugin(schema);
  return schema;
};

describe('tenantPlugin', () => {
  let context: TenantContextService;

  beforeEach(() => {
    context = new TenantContextService();
    setAmbientTenantContext(context);
  });

  it('adds a required, indexed tenantId field to the schema', () => {
    const path = buildSchema().path('tenantId');

    expect(path).toBeDefined();
    expect(path.options.required).toBe(true);
    expect(path.options.index).toBe(true);
  });

  it('scopes a find to the tenant in context', () => {
    const hook = hookFor(buildSchema(), 'find');
    const query = fakeQuery();

    context.run('acme', () => hook.call(query));

    expect(query.filter).toEqual({ tenantId: 'acme' });
  });

  it.each(['find', 'findOne', 'updateMany', 'deleteOne', 'countDocuments'])(
    'scopes %s',
    (operation) => {
      const hook = hookFor(buildSchema(), operation);
      const query = fakeQuery();

      context.run('acme', () => hook.call(query));

      expect(query.filter.tenantId).toBe('acme');
    },
  );

  it('leaves an explicit tenant filter alone', () => {
    const hook = hookFor(buildSchema(), 'find');
    const query = fakeQuery({ tenantId: 'other-tenant' });

    context.run('acme', () => hook.call(query));

    expect(query.filter.tenantId).toBe('other-tenant');
  });

  it('honours an explicit skipTenant opt-out', () => {
    const hook = hookFor(buildSchema(), 'find');
    const query = fakeQuery({}, { skipTenant: true });

    context.run('acme', () => hook.call(query));

    expect(query.filter.tenantId).toBeUndefined();
  });

  it('throws rather than running an unscoped query when there is no tenant', () => {
    const hook = hookFor(buildSchema(), 'find');
    const query = fakeQuery();

    // No context.run(): this is what a background task looks like.
    expect(() => hook.call(query)).toThrow(/no tenant in context/i);
  });

  it('stamps the tenant onto a new document on save', () => {
    const hook = hookFor(buildSchema(), 'save');
    const doc: Record<string, unknown> = { name: 'example' };

    context.run('acme', () => hook.call(doc));

    expect(doc.tenantId).toBe('acme');
  });

  it('does not overwrite a tenant already set on the document', () => {
    const hook = hookFor(buildSchema(), 'save');
    const doc: Record<string, unknown> = {
      name: 'example',
      tenantId: 'preset',
    };

    context.run('acme', () => hook.call(doc));

    expect(doc.tenantId).toBe('preset');
  });
});

describe('TenantContextService', () => {
  it('isolates concurrent requests from each other', async () => {
    const service = new TenantContextService();

    const [a, b] = await Promise.all([
      service.run('tenant-a', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return service.tenantId;
      }),
      service.run('tenant-b', async () => service.tenantId),
    ]);

    expect(a).toBe('tenant-a');
    expect(b).toBe('tenant-b');
  });

  it('reports no tenant outside a run()', () => {
    const service = new TenantContextService();

    expect(service.tenantId).toBeUndefined();
    expect(() => service.requireTenantId()).toThrow(/no tenant in context/i);
  });
});

describe('tenantPlugin on a real model', () => {
  /** No database needed: `validate()` runs the same required-check that `create()` does. */
  const buildModel = () => {
    const schema = new Schema({ name: String });
    tenantPlugin(schema);
    return model(`Doc${Math.random().toString(36).slice(2)}`, schema);
  };

  it('stamps the tenant on a new document before the required check', async () => {
    const context = new TenantContextService();
    setAmbientTenantContext(context);
    const Doc = buildModel();

    await context.run('tenant-a', async () => {
      const doc = new Doc({ name: 'x' });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect((doc as unknown as { tenantId: string }).tenantId).toBe(
        'tenant-a',
      );
    });
  });

  it('keeps an explicit tenant, and refuses a document created with no tenant at all', async () => {
    const context = new TenantContextService();
    setAmbientTenantContext(context);
    const Doc = buildModel();

    const explicit = new Doc({ name: 'x', tenantId: 'tenant-b' });
    await expect(explicit.validate()).resolves.toBeUndefined();

    await expect(new Doc({ name: 'y' }).validate()).rejects.toThrow(
      /no tenant in context/,
    );
  });
});
