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

export interface JWTPayload {
    userId: number;
    email: string;
}

export const generateTokens = (payload: JWTPayload) => {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken };
};

export function verifyAccessToken(token: string) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        return decoded as { userId: number; email: string };
    } catch (error) {
        // Re-throw the error to be caught by middleware
        throw error;
    }
}

export const verifyRefreshToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    } catch (error) {
        return null;
    }
};