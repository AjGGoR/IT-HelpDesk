import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

type BodyParserError = Error & { type?: string; status?: number; statusCode?: number };
const isBodyParserError = (error: unknown): error is BodyParserError =>
  error instanceof Error && typeof (error as BodyParserError).type === 'string';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError)
    return response
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
  if (error instanceof ZodError)
    return response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dane żądania są niepoprawne.',
        details: error.flatten(),
      },
    });
  if (isBodyParserError(error) && error.type === 'entity.parse.failed')
    return response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Treść żądania zawiera niepoprawny JSON.' },
    });
  if (isBodyParserError(error) && error.type === 'entity.too.large')
    return response
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Treść żądania jest zbyt duża.' } });
  console.error('Unhandled API error', error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Wystąpił nieoczekiwany błąd serwera.',
    },
  });
};
