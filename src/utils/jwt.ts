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

export const verifyAccessToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
        return null;
    }
};

export const verifyRefreshToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    } catch (error) {
        return null;
    }
};