import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@/components/spinner/spinner';
import { Button } from '@/components/button/button';
import { useAuth } from '@/context/auth-context/auth-context';
import {
    collaborationApi,
    pendingInviteToken,
} from '@/lib/collaboration/collaboration-api';
import { invitationErrorMessage } from '@/lib/collaboration/share-helpers';

/**
 * Destino del enlace de invitación (/invite/:token).
 * Con sesión: acepta y abre el diagrama. Sin sesión: guarda el token y manda
 * a iniciar sesión; el Dashboard lo acepta después (PendingInvitations).
 */
export const InvitePage: React.FC = () => {
    const { token = '' } = useParams();
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState<string>();
    const started = useRef(false);

    useEffect(() => {
        if (loading || !user || started.current) return;
        started.current = true;
        collaborationApi
            .acceptInvitationByToken(token)
            .then(({ diagramId }) =>
                navigate(`/diagrams/${diagramId}`, { replace: true })
            )
            .catch((err) => setError(invitationErrorMessage(err)));
    }, [loading, user, token, navigate]);

    if (!loading && !user) {
        pendingInviteToken.save(token);
        return <Navigate to="/auth" replace />;
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
            {error ? (
                <>
                    <h1 className="text-lg font-semibold">
                        No se pudo aceptar la invitación
                    </h1>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        {error}
                    </p>
                    <Button onClick={() => navigate('/', { replace: true })}>
                        Ir a mis diagramas
                    </Button>
                </>
            ) : (
                <>
                    <Spinner size="large" className="text-primary" />
                    <p className="text-sm text-muted-foreground">
                        Aceptando invitación…
                    </p>
                </>
            )}
        </div>
    );
};

export default InvitePage;
