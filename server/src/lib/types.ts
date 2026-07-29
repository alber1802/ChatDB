import type { Request } from 'express';

export class AppError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public code?: string
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export interface AuthUser {
    id: string;
    role: string;
}

export type AuthedRequest = Request & {
    user: AuthUser;
};
