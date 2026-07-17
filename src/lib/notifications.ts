/**
 * Centralized notification system using Sileo.
 * Import `notify` instead of calling `sileo` directly to keep
 * a consistent API and allow easy swapping in the future.
 */
import { sileo } from 'sileo';

const getThemeOptions = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        return {
            fill: '#171717',
            styles: {
                title: 'text-white!',
                description: 'text-white/75!',
                badge: 'bg-white/10!',
                button: 'bg-white/10! hover:bg-white/15!',
            },
        };
    } else {
        return {
            fill: '#FFFFFF',
            styles: {
                title: 'text-slate-900!',
                description: 'text-slate-500!',
                badge: 'bg-slate-100!',
                button: 'bg-slate-100! hover:bg-slate-200!',
            },
        };
    }
};

export const notify = {
    success: (title: string, description?: string) =>
        sileo.success({
            title,
            ...(description ? { description } : {}),
            ...getThemeOptions(),
        }),

    error: (title: string, description?: string) =>
        sileo.error({
            title,
            ...(description ? { description } : {}),
            ...getThemeOptions(),
        }),

    warning: (title: string, description?: string) =>
        sileo.warning({
            title,
            ...(description ? { description } : {}),
            ...getThemeOptions(),
        }),

    info: (title: string, description?: string) =>
        sileo.info({
            title,
            ...(description ? { description } : {}),
            ...getThemeOptions(),
        }),

    promise: <T>(
        promise: Promise<T>,
        opts: {
            loading: string;
            success: string;
            error: string;
        }
    ) => {
        const themeOpts = getThemeOptions();
        return sileo.promise(promise, {
            loading: { title: opts.loading, ...themeOpts },
            success: { title: opts.success, ...themeOpts },
            error: { title: opts.error, ...themeOpts },
        });
    },
};
