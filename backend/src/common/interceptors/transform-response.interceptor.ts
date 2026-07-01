import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, ResponseMeta } from '../types/api-response.types';
import { v4 as uuidv4 } from 'uuid';

// Wraps successful controller returns in the standard ApiResponse envelope.
// Follows SRP — only handles response transformation.
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const meta: ResponseMeta = {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    };

    return next.handle().pipe(
      map((data) => ({
        status: 'success' as const,
        data,
        meta,
      })),
    );
  }
}
