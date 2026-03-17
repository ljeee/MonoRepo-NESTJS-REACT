import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { ip?: string }>() as any;

    const method = (req.method || '').toUpperCase();
    const url = req.originalUrl || req.url;
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};

    const missingFields: string[] = [];
    if (['POST', 'PUT', 'PATCH'].includes(method) && body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined || v === null || v === '') missingFields.push(k);
      }
    }

    const safe = (obj: unknown) => {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch {
        return obj;
      }
    };

    // Log request details
    console.log('[REQ]', {
      method,
      url,
      ip: (req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress) ?? undefined,
      params: safe(params),
      query: safe(query),
      body: safe(body),
      missingFields: missingFields.length ? missingFields : undefined,
    });

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - now;
        console.log('[RES]', { method, url, tookMs: ms });
      }),
      catchError((err) => {
        const ms = Date.now() - now;
        const status = (err?.getStatus?.() as number) || err?.status || 500;
        const resp = (err?.getResponse?.() as any) || {};
        const message = err?.message || resp?.message || 'Unexpected error';
        console.error('[ERR]', {
          method,
          url,
          tookMs: ms,
          status,
          message,
          details: safe(resp),
        });
        return throwError(() => err);
      }),
    );
  }
}
