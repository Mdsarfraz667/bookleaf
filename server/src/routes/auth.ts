import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, signToken, type Role } from "../middleware/auth";
import { validate } from "../middleware/validate";

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again shortly." },
});

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * POST /api/auth/login
 * The role is derived from which table the account lives in. Admins are checked
 * first, then authors. The client cannot assert a role.
 */
authRouter.post(
  "/login",
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const admin = await prisma.admin.findUnique({ where: { email } });
    let matched: { user: PublicUser; passwordHash: string } | null = null;

    if (admin) {
      matched = {
        passwordHash: admin.passwordHash,
        user: { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" },
      };
    } else {
      const author = await prisma.author.findUnique({ where: { email } });
      if (author) {
        matched = {
          passwordHash: author.passwordHash,
          user: { id: author.id, name: author.name, email: author.email, role: "AUTHOR" },
        };
      }
    }

    // Same error whether the email is unknown or the password is wrong.
    if (!matched || !(await bcrypt.compare(password, matched.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signToken({ sub: matched.user.id, role: matched.user.role });
    res.json({ token, user: matched.user });
  })
);

/** GET /api/auth/me — the authenticated account, resolved from its own table. */
authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (user.role === "ADMIN") {
      const admin = await prisma.admin.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true },
      });
      if (!admin) throw new ApiError(401, "Account no longer exists");
      res.json({ user: { ...admin, role: "ADMIN" satisfies Role } });
      return;
    }

    const author = await prisma.author.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, externalId: true, city: true },
    });
    if (!author) throw new ApiError(401, "Account no longer exists");
    res.json({ user: { ...author, role: "AUTHOR" satisfies Role } });
  })
);
