import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context/auth-context';
import { Spinner } from '@/components/spinner/spinner';
import { IS_SUPABASE_ENABLED } from '@/lib/env';

export const ProtectedRoute: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { user, loading } = useAuth();

    // Si Supabase no está configurado, las rutas no se protegen y se usa el modo IndexedDB local.
    if (!IS_SUPABASE_ENABLED) {
        return <>{children}</>;
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

    return <>{children}</>;
};
export default ProtectedRoute;
