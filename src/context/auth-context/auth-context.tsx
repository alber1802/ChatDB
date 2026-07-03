/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/lib/rbac';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    role: string | null;
    permissions: string[];
    loading: boolean;
    signIn: (
        email: string,
        password: string
    ) => Promise<{ error: AuthError | null }>;
    signUp: (
        email: string,
        password: string
    ) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    isAdmin: () => boolean;
    refreshProfile: () => Promise<void>;
}

export const authContext = createContext<AuthContextType>(
    {} as AuthContextType
);

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

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshProfile = async () => {
        if (user) {
            const data = await fetchProfileAndPermissions(user.id);
            setProfile(data.profile);
            setRole(data.role);
            setPermissions(data.permissions);
        }
    };

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

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

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
                signIn,
                signUp,
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
