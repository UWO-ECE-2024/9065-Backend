import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

// Extends Express Request type to include user information after authentication
interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

// Type guard to check if a request is authenticated
function isAuthenticated(req: any): req is AuthenticatedRequest {
  return req.user !== undefined && req.user !== null;
}

export type AuthRequest = AuthenticatedRequest;

// Authentication middleware
// Validates JWT tokens and adds user information to the request
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if Authorization header exists and starts with "Bearer "
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

  // Extract the token from the Authorization header
  const token = authHeader.split(" ")[1];

  try {
    // Verify the token and extract user information
    const payload = verifyAccessToken(token);
    if (!payload) {
      throw new Error("Invalid token");
    }
    // Add the user information to the request object
    // Type assertion is used to satisfy TypeScript
    (req as AuthenticatedRequest).user = payload;
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      // Handle expired token error
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
      // Handle invalid token format or signature
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
      // Handle any other authentication errors
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
