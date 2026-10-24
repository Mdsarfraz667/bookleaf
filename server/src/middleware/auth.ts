import type { RequestHandler } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { ApiError } from "./errorHandler";

export type Role = "ADMIN" | "AUTHOR";

export interface AuthUser {
  id: string;
  role: Role;
}

interface TokenClaims {
  sub: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "Server auth is not configured");
  }
  return secret;
}

/** Sign a stateless JWT. Role is set by the server, never by the client. */
export function signToken(claims: TokenClaims): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign({ role: claims.role }, getSecret(), { subject: claims.sub, ...options });
}

/** Verify the Bearer token and attach req.user. 401 when missing/invalid. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === "string" || !decoded.sub || typeof decoded.sub !== "string") {
      return next(new ApiError(401, "Invalid token"));
    }
    const role = (decoded as jwt.JwtPayload).role;
    if (role !== "ADMIN" && role !== "AUTHOR") {
      return next(new ApiError(401, "Invalid token"));
    }
    req.user = { id: decoded.sub, role };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
};

/** Allow only the given roles; otherwise 403. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have access to this resource"));
    }
    next();
  };
}
