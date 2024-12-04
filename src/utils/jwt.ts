import jwt from "jsonwebtoken";
import { config } from "dotenv";

config();

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET || !process.env.JWT_EXPIRES_IN || !process.env.JWT_REFRESH_EXPIRES_IN) {
    throw new Error("JWT environment variables must be defined");
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;

// User-specific payload
export interface UserJWTPayload {
    userId: number;
    email: string;
    isAdmin?: false;
}

// Admin-specific payload
export interface AdminJWTPayload {
    adminId: number;
    email: string;
    isAdmin: true;
}

// Union type for all possible payloads
export type JWTPayload = UserJWTPayload | AdminJWTPayload;

export const generateTokens = (payload: JWTPayload) => {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken };
};

export function verifyAccessToken(token: string): JWTPayload {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        if ('adminId' in decoded) {
            // Admin token
            return {
                adminId: decoded.adminId,
                email: decoded.email,
                isAdmin: true
            };
        } else {
            // User token
            return {
                userId: decoded.userId,
                email: decoded.email,
                isAdmin: false
            };
        }
    } catch (error) {
        throw error;
    }
}

export const verifyRefreshToken = (token: string) => {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
        if ('adminId' in decoded) {
            // Admin token
            return {
                adminId: decoded.adminId,
                email: decoded.email,
                isAdmin: true
            };
        } else {
            // User token
            return {
                userId: decoded.userId,
                email: decoded.email,
                isAdmin: false
            };
        }
    } catch (error) {
        return null;
    }
};