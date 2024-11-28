import { Router } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateTokens } from "../utils/jwt";
import { generator } from "../libs/id_generator";
import { z } from "zod";
import { AuthRequest, authMiddleware } from "../middleware/auth";

const authRoutes = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 */
authRoutes.post("/register", async (req: any, res: any) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          issues: validation.error.issues.map((issue) => ({
            code: "validation_error",
            message: issue.message,
          })),
        },
      });
    }

    const { email, password, firstName, lastName, phone } = validation.data;

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .execute();

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "user_exists",
              message: "User with this email already exists",
            },
          ],
        },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        userId: Number(generator.nextId()),
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
      })
      .returning({
        userId: users.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .execute();

    res.status(201).json({
      message: "User registered successfully",
      data: newUser[0],
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 */
authRoutes.post("/login", async (req: any, res: any) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          issues: validation.error.issues.map((issue) => ({
            code: "validation_error",
            message: issue.message,
          })),
        },
      });
    }

    const { email, password } = validation.data;

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .execute();

    if (user.length === 0) {
      return res.status(401).json({
        error: {
          issues: [
            {
              code: "invalid_credentials",
              message: "Invalid email or password",
            },
          ],
        },
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      password,
      user[0].passwordHash
    );

    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          issues: [
            {
              code: "invalid_credentials",
              message: "Invalid email or password",
            },
          ],
        },
      });
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user[0].userId,
      email: user[0].email,
    });

    // Update refresh token in database
    await db
      .update(users)
      .set({ refreshToken: tokens.refreshToken })
      .where(eq(users.userId, user[0].userId))
      .execute();

    res.json({
      message: "Login successful",
      data: {
        user: {
          userId: user[0].userId,
          email: user[0].email,
          firstName: user[0].firstName,
          lastName: user[0].lastName,
        },
        tokens,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 */
authRoutes.post("/refresh", async (req: any, res: any) => {
  try {
    const validation = refreshTokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          issues: validation.error.issues.map((issue) => ({
            code: "validation_error",
            message: issue.message,
          })),
        },
      });
    }

    const { refreshToken } = validation.data;

    // Find user with this refresh token
    const user = await db
      .select()
      .from(users)
      .where(eq(users.refreshToken, refreshToken))
      .execute();

    if (user.length === 0) {
      return res.status(401).json({
        error: {
          issues: [
            {
              code: "invalid_refresh_token",
              message: "Invalid refresh token",
            },
          ],
        },
      });
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user[0].userId,
      email: user[0].email,
    });

    // Update refresh token in database
    await db
      .update(users)
      .set({ refreshToken: tokens.refreshToken })
      .where(eq(users.userId, user[0].userId))
      .execute();

    res.json({
      message: "Tokens refreshed successfully",
      data: { tokens },
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
authRoutes.post(
  "/logout",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      // Clear refresh token in database
      await db
        .update(users)
        .set({ refreshToken: null })
        .where(eq(users.userId, req.user.userId))
        .execute();

      res.json({
        message: "Logged out successfully",
      });
    } catch (error) {
      res.status(500).json({
        error: {
          issues: [
            {
              code: "internal_server_error",
              message: (error as Error).message ?? "Internal server error",
            },
          ],
        },
      });
    }
  }
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: number
 *                         email:
 *                           type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
authRoutes.get("/me", authMiddleware as any, (req: any, res: any) => {
  res.json({
    message: "Protected route accessed successfully",
    data: {
      user: req.user,
    },
  });
});

export default authRoutes;
