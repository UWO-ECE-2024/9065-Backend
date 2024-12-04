import { Router } from "express";
import { db } from "../db";
import { admins } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateTokens } from "../utils/jwt";
import { generator } from "../libs/id_generator";
import { z } from "zod";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { Request, Response } from "express";

const adminAuthRoutes = Router();

// Validation schemas
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    username: z.string().min(1),
    inviteSecret: z.string().min(1),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const refreshTokenSchema = z.object({
    refreshToken: z.string(),
});

// Register admin
adminAuthRoutes.post("/register", async (req: any, res: any) => {
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

        const { email, password, inviteSecret } = validation.data;

        // Verify invite secret
        if (inviteSecret !== process.env.ADMIN_INVITE_SECRET) {
            return res.status(403).json({
                error: {
                    issues: [
                        {
                            code: "invalid_invite_secret",
                            message: "Invalid invite secret",
                        },
                    ],
                },
            });
        }

        const existingAdmin = await db
            .select()
            .from(admins)
            .where(eq(admins.email, email))
            .execute();

        if (existingAdmin.length > 0) {
            return res.status(400).json({
                error: {
                    issues: [
                        {
                            code: "admin_exists",
                            message: "Admin with this email already exists",
                        },
                    ],
                },
            });
        }

        const passwordHash = await hashPassword(password);
        const adminId = Number(generator.nextId());

        // Simplified insert operation
        const newAdmin = await db
            .insert(admins)
            .values({
                adminId,
                email,
                passwordHash,
                username: validation.data.username,
                isActive: true,
                refreshToken: null,
            })
            .returning({
                adminId: admins.adminId,
                email: admins.email,
                username: admins.username,
            })
            .execute();

        res.status(201).json({
            message: "Admin registered successfully",
            data: {
                adminId: newAdmin[0].adminId,
                email: newAdmin[0].email,
                username: newAdmin[0].username,
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

// Login admin
adminAuthRoutes.post("/login", async (req: any, res: any) => {
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

        const admin = await db
            .select()
            .from(admins)
            .where(eq(admins.email, email))
            .execute();

        if (admin.length === 0) {
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

        const isValidPassword = await verifyPassword(
            password,
            admin[0].passwordHash
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

        const tokens = generateTokens({
            adminId: admin[0].adminId,
            email: admin[0].email,
            isAdmin: true,
        });

        await db
            .update(admins)
            .set({ refreshToken: tokens.refreshToken })
            .where(eq(admins.adminId, admin[0].adminId))
            .execute();

        res.json({
            message: "Login successful",
            data: {
                admin: {
                    adminId: admin[0].adminId,
                    email: admin[0].email,
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

// Refresh token
adminAuthRoutes.post("/refresh", async (req: any, res: any) => {
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

        const admin = await db
            .select()
            .from(admins)
            .where(eq(admins.refreshToken, refreshToken))
            .execute();

        if (admin.length === 0) {
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

        const tokens = generateTokens({
            adminId: admin[0].adminId,
            email: admin[0].email,
            isAdmin: true,
        });

        await db
            .update(admins)
            .set({ refreshToken: tokens.refreshToken })
            .where(eq(admins.adminId, admin[0].adminId))
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

// Logout admin
adminAuthRoutes.post("/logout", adminAuthMiddleware as any, async (req: any, res: any) => {
    try {
        await db
            .update(admins)
            .set({ refreshToken: null })
            .where(eq(admins.adminId, (req as any).admin.adminId))
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
});

// Get current admin (for testing)
adminAuthRoutes.get("/me", adminAuthMiddleware as any, async (req: any, res: any) => {
    res.json({
        message: "Protected route accessed successfully",
        data: {
            admin: (req as any).admin,
        },
    });
});

export default adminAuthRoutes;