import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AdminJWTPayload } from "../utils/jwt";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

// Extends Express Request type to include admin information
interface AuthenticatedAdminRequest extends Request {
    admin: {
        adminId: number;
        email: string;
    };
}

// Type guard to check if the payload is an admin payload
function isAdminPayload(payload: any): payload is AdminJWTPayload {
    return 'adminId' in payload && payload.isAdmin === true;
}

// Admin Authentication middleware
export const adminAuthMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: {
                issues: [
                    {
                        code: "unauthorized",
                        message: "No token provided",
                    },
                ],
            },
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = verifyAccessToken(token);
        if (!isAdminPayload(payload)) {
            throw new Error("Invalid token or not admin");
        }
        (req as AuthenticatedAdminRequest).admin = {
            adminId: payload.adminId,
            email: payload.email,
        };
        next();
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            return res.status(401).json({
                error: {
                    issues: [
                        {
                            code: "token_expired",
                            message: "Access token has expired",
                            expiredAt: error.expiredAt,
                        },
                    ],
                },
            });
        } else if (error instanceof JsonWebTokenError) {
            return res.status(401).json({
                error: {
                    issues: [
                        {
                            code: "invalid_token",
                            message: "Invalid token format or signature",
                        },
                    ],
                },
            });
        }

        return res.status(401).json({
            error: {
                issues: [
                    {
                        code: "unauthorized",
                        message: "Admin authentication failed",
                    },
                ],
            },
        });
    }
};