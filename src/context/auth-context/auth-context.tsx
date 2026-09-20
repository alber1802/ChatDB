/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
    useCallback,
} from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/lib/rbac';
import { API_URL, IS_API_ENABLED } from '@/lib/env';

// ─── Constants ────────────────────────────────────────────────────────────────
/** How many failures trigger a temporary cooldown */
const ATTEMPTS_BEFORE_COOLDOWN = 3;
/** Cooldown duration in milliseconds (60 seconds) */
const COOLDOWN_MS = 60_000;
/** How many total failures trigger a permanent account block */
const ATTEMPTS_BEFORE_PERMANENT_BLOCK = 9;

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    role: string | null;
    permissions: string[];
    loading: boolean;
    /** Current consecutive failed login attempts (resets on success or cooldown end) */
    loginAttempts: number;
    /** True while the user is in the temporary 60-second cooldown window */
    isLockedOut: boolean;
    /** Date when the cooldown expires (null if not in cooldown) */
    lockoutUntil: Date | null;
    signIn: (
        email: string,
        password: string
    ) => Promise<{ error: AuthError | Error | null }>;
    signOut: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    isAdmin: () => boolean;
    refreshProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
export const authContext = createContext<AuthContextType>(
    {} as AuthContextType
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fetchProfileAndPermissions = async (userId: string) => {
    try {
        const { data: profile, error: pError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (pError) throw pError;

        if (!profile) {
            return { profile: null, role: null, permissions: [] };
        }

        const { data: perms, error: permsError } = await supabase
            .from('role_permissions')
            .select('permission_id')
            .eq('role_id', profile.role_id);

        if (permsError) throw permsError;

        const permissionKeys = perms ? perms.map((p) => p.permission_id) : [];

        return {
            profile,
            role: profile.role_id,
            permissions: permissionKeys,
        };
    } catch (err) {
        console.error('Error fetching user profile/permissions:', err);
        return { profile: null, role: null, permissions: [] };
    }
};

/** Persist the failed login attempt to Supabase for audit logs */
const recordLoginAttempt = async (email: string) => {
    try {
        await supabase.from('login_attempts').insert({
            email,
            attempted_at: new Date().toISOString(),
        });
    } catch {
        // Non-critical – do not surface to user
    }
};

/** Mark a user profile as permanently blocked in Supabase */
const blockUserProfile = async (email: string) => {
    try {
        const cleanEmail = email.trim().toLowerCase();
        localStorage.setItem(`blocked_${cleanEmail}`, 'true');
        await supabase.rpc('block_user_by_email', { email_input: cleanEmail });
    } catch (err) {
        console.error('Error calling block_user_by_email RPC:', err);
    }
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Login rate-limiting state ──────────────────────────────────────────
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
    const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Profile helpers ────────────────────────────────────────────────────
    const refreshProfile = useCallback(async () => {
        if (user) {
            const data = await fetchProfileAndPermissions(user.id);
            setProfile(data.profile);
            setRole(data.role);
            setPermissions(data.permissions);
        }
    }, [user]);

    // ── Auth state subscription ────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        const handleAuthChange = async (currentSession: Session | null) => {
            if (!isMounted) return;
            setSession(currentSession);
            const currentUser = currentSession?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                const data = await fetchProfileAndPermissions(currentUser.id);
                if (isMounted) {
                    setProfile(data.profile);
                    setRole(data.role);
                    setPermissions(data.permissions);
                    setLoading(false);
                }
            } else {
                if (isMounted) {
                    setProfile(null);
                    setRole(null);
                    setPermissions([]);
                    setLoading(false);
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            handleAuthChange(session);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // ── Cleanup cooldown timer on unmount ──────────────────────────────────
    useEffect(() => {
        return () => {
            if (cooldownTimerRef.current) {
                clearTimeout(cooldownTimerRef.current);
            }
        };
    }, []);

    // ── signIn with progressive blocking ──────────────────────────────────
    const signIn = useCallback(
        async (
            email: string,
            password: string
        ): Promise<{ error: AuthError | Error | null }> => {
            const cleanEmail = email.trim().toLowerCase();

            // Prefer server-side lockout when API is enabled (not bypassable via localStorage)
            if (IS_API_ENABLED) {
                try {
                    const res = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: cleanEmail,
                            password,
                        }),
                    });
                    const payload = (await res.json().catch(() => ({}))) as {
                        message?: string;
                        error?: string;
                        access_token?: string;
                        refresh_token?: string;
                    };

                    if (!res.ok) {
                        if (payload.error === 'cooldown') {
                            setIsLockedOut(true);
                            setLockoutUntil(new Date(Date.now() + COOLDOWN_MS));
                        }
                        return {
                            error: new Error(
                                payload.message ?? 'Invalid login credentials'
                            ),
                        };
                    }

                    if (!payload.access_token || !payload.refresh_token) {
                        return {
                            error: new Error('Invalid login response'),
                        };
                    }

                    const { error: sessionError } =
                        await supabase.auth.setSession({
                            access_token: payload.access_token,
                            refresh_token: payload.refresh_token,
                        });

                    if (sessionError) return { error: sessionError };

                    setLoginAttempts(0);
                    setIsLockedOut(false);
                    setLockoutUntil(null);
                    return { error: null };
                } catch (err) {
                    return {
                        error:
                            err instanceof Error
                                ? err
                                : new Error('Login failed'),
                    };
                }
            }

            // Fallback: client-side lockout + direct Supabase Auth
            const cooldownStr = localStorage.getItem(`cooldown_${cleanEmail}`);
            if (cooldownStr) {
                const until = new Date(cooldownStr);
                if (until.getTime() > Date.now()) {
                    const remaining = Math.ceil(
                        (until.getTime() - Date.now()) / 1000
                    );
                    return {
                        error: new Error(
                            `Demasiados intentos. Espera ${remaining} segundos antes de intentarlo de nuevo.`
                        ),
                    };
                } else {
                    localStorage.removeItem(`cooldown_${cleanEmail}`);
                }
            }

            const localBlocked =
                localStorage.getItem(`blocked_${cleanEmail}`) === 'true';
            let isBlockedOnServer = false;
            try {
                const { data: serverBlocked, error: rpcError } =
                    await supabase.rpc('check_user_blocked_by_email', {
                        email_input: cleanEmail,
                    });
                if (!rpcError && serverBlocked !== null) {
                    isBlockedOnServer = serverBlocked;
                }
            } catch (err) {
                console.error('Error checking block status on server:', err);
            }

            if (isBlockedOnServer) {
                localStorage.setItem(`blocked_${cleanEmail}`, 'true');
                return {
                    error: new Error(
                        'Tu cuenta ha sido bloqueada por el administrador. Contacta al soporte para recuperar el acceso.'
                    ),
                };
            } else if (localBlocked) {
                localStorage.removeItem(`blocked_${cleanEmail}`);
                localStorage.removeItem(`attempts_${cleanEmail}`);
                localStorage.removeItem(`cooldown_${cleanEmail}`);
            }

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (!error) {
                localStorage.removeItem(`attempts_${cleanEmail}`);
                localStorage.removeItem(`cooldown_${cleanEmail}`);
                localStorage.removeItem(`blocked_${cleanEmail}`);

                setLoginAttempts(0);
                setIsLockedOut(false);
                setLockoutUntil(null);
                if (cooldownTimerRef.current) {
                    clearTimeout(cooldownTimerRef.current);
                    cooldownTimerRef.current = null;
                }

                const { data: prof } = await supabase
                    .from('user_profiles')
                    .select('is_blocked')
                    .eq(
                        'user_id',
                        (await supabase.auth.getUser()).data.user?.id ?? ''
                    )
                    .maybeSingle();

                if (prof?.is_blocked) {
                    await supabase.auth.signOut();
                    localStorage.setItem(`blocked_${cleanEmail}`, 'true');
                    return {
                        error: new Error(
                            'Tu cuenta ha sido bloqueada por el administrador. Contacta al soporte para recuperar el acceso.'
                        ),
                    };
                }

                return { error: null };
            }

            await recordLoginAttempt(cleanEmail);

            const prevAttempts = parseInt(
                localStorage.getItem(`attempts_${cleanEmail}`) || '0',
                10
            );
            const newAttempts = prevAttempts + 1;
            localStorage.setItem(
                `attempts_${cleanEmail}`,
                newAttempts.toString()
            );
            setLoginAttempts(newAttempts);

            if (newAttempts >= ATTEMPTS_BEFORE_PERMANENT_BLOCK) {
                await blockUserProfile(cleanEmail);
                setLoginAttempts(0);
                return {
                    error: new Error(
                        'Tu cuenta ha sido bloqueada por superar el límite de intentos fallidos. Un administrador debe desbloquearte.'
                    ),
                };
            }

            if (newAttempts % ATTEMPTS_BEFORE_COOLDOWN === 0) {
                const until = new Date(Date.now() + COOLDOWN_MS);
                localStorage.setItem(
                    `cooldown_${cleanEmail}`,
                    until.toISOString()
                );
                setIsLockedOut(true);
                setLockoutUntil(until);

                cooldownTimerRef.current = setTimeout(() => {
                    setIsLockedOut(false);
                    setLockoutUntil(null);
                }, COOLDOWN_MS);
            }

            return { error };
        },
        []
    );

    // ── signOut ────────────────────────────────────────────────────────────
    const signOut = async () => {
        await supabase.auth.signOut();
    };

    // ── RBAC helpers ───────────────────────────────────────────────────────
    const hasPermission = (permission: string) => {
        if (role === 'super_admin') return true;
        return permissions.includes(permission);
    };

    const isAdmin = () => {
        return role === 'super_admin' || role === 'admin';
    };

    return (
        <authContext.Provider
            value={{
                user,
                session,
                profile,
                role,
                permissions,
                loading,
                loginAttempts,
                isLockedOut,
                lockoutUntil,
                signIn,
                signOut,
                hasPermission,
                isAdmin,
                refreshProfile,
            }}
        >
            {children}
        </authContext.Provider>
    );
};

export const useAuth = () => useContext(authContext);
