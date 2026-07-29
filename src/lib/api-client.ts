import { supabase } from '@/lib/supabase';
import { API_URL } from '@/lib/env';

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}

export async function apiFetch<T>(
    path: string,
    options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
    const { auth = true, headers, ...rest } = options;
    const finalHeaders = new Headers(headers);
    if (!finalHeaders.has('Content-Type') && rest.body) {
        finalHeaders.set('Content-Type', 'application/json');
    }

    if (auth) {
        const token = await getAccessToken();
        if (!token) {
            throw new ApiError('Not authenticated', 401, 'missing_token');
        }
        finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: finalHeaders,
    });

    if (res.status === 204) {
        return undefined as T;
    }

    const text = await res.text();
    let payload: unknown = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = { message: text };
        }
    }

    if (!res.ok) {
        const err = payload as { message?: string; error?: string } | null;
        throw new ApiError(
            err?.message ?? `Request failed (${res.status})`,
            res.status,
            err?.error
        );
    }

    return payload as T;
}

export function buildIncludeQuery(options?: {
    includeTables?: boolean;
    includeRelationships?: boolean;
    includeDependencies?: boolean;
    includeAreas?: boolean;
    includeCustomTypes?: boolean;
    includeNotes?: boolean;
}): string {
    if (!options) return '';
    const params = new URLSearchParams();
    if (options.includeTables) params.set('includeTables', 'true');
    if (options.includeRelationships)
        params.set('includeRelationships', 'true');
    if (options.includeDependencies) params.set('includeDependencies', 'true');
    if (options.includeAreas) params.set('includeAreas', 'true');
    if (options.includeCustomTypes) params.set('includeCustomTypes', 'true');
    if (options.includeNotes) params.set('includeNotes', 'true');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}
