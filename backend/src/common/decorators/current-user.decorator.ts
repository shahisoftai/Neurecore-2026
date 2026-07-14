import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Extracts the authenticated user from the request.
// Usage:
//   @CurrentUser() user: JwtPayload       // full user object
//   @CurrentUser('tenantId') tenantId: string  // single property
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
