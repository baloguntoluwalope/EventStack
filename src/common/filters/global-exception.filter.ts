import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message = isHttpException
      ? (exceptionResponse as any)?.message || exception.message
      : 'Internal server error';
    const error = isHttpException
      ? (exceptionResponse as any)?.error || exception.name
      : 'InternalServerError';

    if (statusCode >= 500) {
      this.logger.error(`${request.method} ${request.url} — ${message}`, (exception as Error)?.stack);
    }

    const body: ErrorResponse = {
      success: false,
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}