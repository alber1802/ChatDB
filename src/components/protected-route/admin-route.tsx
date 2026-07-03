import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context/auth-context';
import { Spinner } from '@/components/spinner/spinner';
import { IS_SUPABASE_ENABLED } from '@/lib/env';

export const AdminRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
    const { user, isAdmin, loading } = useAuth();

    // Si Supabase no está activo, no tiene sentido permitir acceso al panel admin
    if (!IS_SUPABASE_ENABLED) {
        return <Navigate to="/" replace />;
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#090b10]">
                <Spinner size="large" className="text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    if (!isAdmin()) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
