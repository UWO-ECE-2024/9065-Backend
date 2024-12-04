import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, UserJWTPayload } from "../utils/jwt";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

// Extends Express Request type to include user information after authentication
interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

// Type guard to check if the payload is a user payload
function isUserPayload(payload: any): payload is UserJWTPayload {
  return 'userId' in payload;
}

// Authentication middleware
export const authMiddleware = (
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
    if (isUserPayload(payload)) {
      (req as AuthenticatedRequest).user = {
        userId: payload.userId,
        email: payload.email,
      };
      next();
    } else {
      throw new Error("Invalid user token");
    }
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
            message: "Authentication failed",
          },
        ],
      },
    });
  }
};