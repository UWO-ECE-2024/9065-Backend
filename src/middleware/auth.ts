import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
    };
}

export const authMiddleware = (
    req: AuthRequest,
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
    const payload = verifyAccessToken(token);

    if (!payload) {
        return res.status(401).json({
            error: {
                issues: [
                    {
                        code: "unauthorized",
                        message: "Invalid token",
                    },
                ],
            },
        });
    }

    req.user = payload;
    next();
};