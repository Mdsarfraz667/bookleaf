import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/** Known error shape returned to clients: always { error, details? }. */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/** Wrap an async handler so rejected promises reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** 404 for unmatched routes. */
export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, "Resource not found"));
}

interface ErrorBody {
  error: string;
  details?: unknown;
}

/** Central error middleware. Maps known errors to clean 4xx; never leaks stack traces. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let status = 500;
  let body: ErrorBody = { error: "Internal server error" };

  if (err instanceof ZodError) {
    status = 400;
    body = {
      error: "Validation failed",
      details: err.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  } else if (err instanceof ApiError) {
    status = err.status;
    body = err.details === undefined ? { error: err.message } : { error: err.message, details: err.details };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      const target = (err.meta?.target as string[] | undefined)?.join(", ");
      body = { error: target ? `A record with this ${target} already exists` : "Unique constraint violation" };
    } else if (err.code === "P2025") {
      status = 404;
      body = { error: "Resource not found" };
    } else {
      status = 400;
      body = { error: "Database request error" };
    }
  }

  // Only 500s are unexpected and worth logging; 4xx are client problems.
  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(body);
}
