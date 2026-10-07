import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';

/**
 * Opt a route out of `TenantGuard`.
 *
 * Only for endpoints that genuinely have no tenant: `/health`, readiness
 * probes, and the OpenAPI document. Anything that touches data must not use it.
 */
export const SkipTenant = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_TENANT_KEY, true);

export interface TenantRequest {
  tenantId?: string;
}

/**
 * Inject the resolved tenant id into a handler parameter.
 *
 * `TenantGuard` has already run and rejected the request if the tenant was
 * missing, so this is always a non-empty string inside a guarded handler.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    return request.tenantId ?? '';
  },
);
