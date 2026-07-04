export const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return (
            date.toLocaleDateString() +
            ' ' +
            date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            })
        );
    } catch {
        return '-';
    }
};

export const formatDateOnly = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString();
    } catch {
        return '-';
    }
};

export const formatRelativeTime = (
    dateStr: string | null | undefined
): string => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} días`;

        return date.toLocaleDateString();
    } catch {
        return '-';
    }
};
