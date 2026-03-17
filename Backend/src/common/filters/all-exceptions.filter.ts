import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    if (!httpAdapter) {
        return;
    }

    const ctx = host.switchToHttp();

    let httpStatus: number;
    let errorMessage: string | object;

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();
      errorMessage = typeof response === 'string' ? response : (response as any).message || response;
    } else {
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'Internal server error';
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: errorMessage,
    };

    if (httpStatus >= 500) {
      this.logger.error(
        `[${httpAdapter.getRequestMethod(ctx.getRequest())}] ${httpAdapter.getRequestUrl(
          ctx.getRequest(),
        )} - ${exception instanceof Error ? exception.stack : exception}`,
      );
    } else {
      this.logger.warn(
        `[${httpAdapter.getRequestMethod(ctx.getRequest())}] ${httpAdapter.getRequestUrl(
          ctx.getRequest(),
        )} - Status: ${httpStatus} Message: ${JSON.stringify(errorMessage)}`,
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
