import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { Request } from 'express';
import { IdempotencyService } from './idempotency.service';

/**
 * Interceptor that wraps a controller method with idempotency.
 *
 * Usage:
 *   @UseInterceptors(IdempotencyInterceptor)
 *   @Post()
 *   create(@IdempotencyKey() key: string, @Body() body: CreateDto) { ... }
 *
 * The interceptor reads the Idempotency-Key header, hashes the request body,
 * and uses the IdempotencyService to deduplicate.
 *
 * On the first call, the wrapped handler is invoked and the result is cached.
 * On replay, the cached result is returned without invoking the handler.
 *
 * This is a thin wrapper around IdempotencyService.run(). The handler runs
 * normally otherwise; this interceptor only adds the replay/cache behavior.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const tenantId =
      (req as any).tenantId ??
      (req as any).user?.tenantId ??
      (req as any).serviceIdentity?.tenantId;
    if (!tenantId) {
      // No tenant context: cannot scope idempotency. Skip the wrapper.
      return next.handle();
    }
    const key =
      (req.headers['idempotency-key'] as string | undefined) ??
      (req.headers['Idempotency-Key'] as string | undefined);
    if (!key) {
      return next.handle();
    }
    const requestBody = (req as any).body ?? {};
    return from(
      this.idempotency.run(
        {
          tenantId,
          key,
          requestPath: req.path,
          requestBody,
        },
        {
          handler: async () => {
            // Run the handler synchronously within the idempotent block.
            // We use firstValueFrom to get the result of the observable chain.
            return new Promise<{ status: number; body: any }>((resolve, reject) => {
              next.handle().subscribe({
                next: (body) => resolve({ status: 200, body }),
                error: (err) => reject(err),
              });
            });
          },
        },
      ),
    ).pipe(
      switchMap((result) => {
        return of(result.body);
      }),
    );
  }
}