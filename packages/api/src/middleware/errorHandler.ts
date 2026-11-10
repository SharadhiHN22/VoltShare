import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// ── Custom Error Class ──────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ── Global Error Handler ────────────────────────────

/**
 * Express global error handler middleware.
 * Handles AppError, Prisma errors, and unexpected errors.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ── AppError (thrown explicitly by controllers) ──
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // ── Zod validation errors (fallback) ────────────
  if (err instanceof ZodError || err.name === 'ZodError' || Array.isArray((err as any)?.issues)) {
    const issues = (err as any).issues || (err as any).errors || [];
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: issues.map((issue: any) => ({
        field: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
        message: issue.message,
      })),
    });
    return;
  }

  // ── Prisma known-request errors ─────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        res.status(409).json({
          success: false,
          error: `A record with this ${target} already exists.`,
        });
        return;
      }

      // Record not found
      case 'P2025': {
        res.status(404).json({
          success: false,
          error: 'The requested record was not found.',
        });
        return;
      }

      // Foreign key constraint failed
      case 'P2003': {
        res.status(400).json({
          success: false,
          error: 'Related record not found. Check your reference IDs.',
        });
        return;
      }

      default:
        break;
    }
  }

  // ── Prisma validation error ─────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'Invalid data provided.',
    });
    return;
  }

  // ── Unexpected / unknown errors ─────────────────
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : err.message,
  });
};
