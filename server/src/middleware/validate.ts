import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type RequestPart = "body" | "params" | "query";

type Schemas = Partial<Record<RequestPart, ZodType>>;

/**
 * Validate the given request parts against Zod schemas and replace each part
 * with its parsed (and type-coerced) value. ZodErrors propagate to the error
 * middleware, which renders them as a 400 with per-field details.
 *
 * Uses Object.defineProperty because in Express 5 `req.query` is a getter and
 * cannot be reassigned directly.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      for (const part of ["body", "params", "query"] as const) {
        const schema = schemas[part];
        if (!schema) continue;
        const parsed = schema.parse(req[part]);
        Object.defineProperty(req, part, {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
