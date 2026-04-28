import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: any }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined;
    let exceptionResponse: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;

        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message;
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // --- Logging Strategy ---
    const { method, originalUrl, ip, body, user } = request;
    const isProduction = process.env.NODE_ENV === 'production';
    const isUserError = status >= 400 && status < 500;

    // Sanitize body to avoid leaking sensitive data
    const sanitizedBody = body ? { ...body } : {};
    if ('password' in sanitizedBody) {
      sanitizedBody.password = '[HIDDEN]';
    }

    const logMessage = `[${method}] ${originalUrl} - Status: ${status} | IP: ${ip} | UserID: ${user?.id || 'Anonymous'}`;

    if (isUserError) {
      // 4xx errors - Usually user's fault (e.g. Validation, Unauthorized).
      // Only log in non-production environments to avoid log noise.
      if (!isProduction) {
        this.logger.warn(`${logMessage} - Message: ${message}`);
        this.logger.debug(
          `Body: ${JSON.stringify(sanitizedBody)} | Response: ${JSON.stringify(exceptionResponse)}`,
        );
      }
    } else {
      // 5xx errors - System errors (database connection, null pointers, etc). Always log with stack trace.
      const stackTrace = exception instanceof Error ? exception.stack : '';
      this.logger.error(`${logMessage} - Error: ${message}`, stackTrace);
      this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}
