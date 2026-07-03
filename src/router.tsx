import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import type { TemplatePageLoaderData } from './pages/template-page/template-page';
import type { TemplatesPageLoaderData } from './pages/templates-page/templates-page';
import { getTemplatesAndAllTags } from './templates-data/template-utils';
import { RootFallback } from './components/root-fallback';
import { RouteErrorBoundary } from './components/route-error-boundary/route-error-boundary';

import { ProtectedRoute } from './components/protected-route/protected-route';

const routes: RouteObject[] = [
    {
        path: '/',
        element: <Outlet />,
        errorElement: <RouteErrorBoundary />,
        hydrateFallbackElement: <RootFallback />,
        children: [
            {
                path: 'auth',
                async lazy() {
                    const { AuthPage } =
                        await import('./pages/auth-page/auth-page');
                    return {
                        element: <AuthPage />,
                    };
                },
            },
            ...['', 'diagrams/:diagramId'].map((path) => ({
                path,
                async lazy() {
                    const { EditorPage } =
                        await import('./pages/editor-page/editor-page');

                    return {
                        element: (
                            <ProtectedRoute>
                                <EditorPage />
                            </ProtectedRoute>
                        ),
                    };
                },
            })),
            {
                path: 'examples',
                async lazy() {
                    const { ExamplesPage } =
                        await import('./pages/examples-page/examples-page');
                    return {
                        element: <ExamplesPage />,
                    };
                },
            },
            {
                id: 'templates',
                path: 'templates',
                async lazy() {
                    const { TemplatesPage } =
                        await import('./pages/templates-page/templates-page');
                    return {
                        element: <TemplatesPage />,
                    };
                },

                loader: async (): Promise<TemplatesPageLoaderData> => {
                    const { tags, templates } = await getTemplatesAndAllTags();

                    return {
                        allTags: tags,
                        templates,
                    };
                },
            },
            {
                id: 'templates_featured',
                path: 'templates/featured',
                async lazy() {
                    const { TemplatesPage } =
                        await import('./pages/templates-page/templates-page');
                    return {
                        element: <TemplatesPage />,
                    };
                },
                loader: async (): Promise<TemplatesPageLoaderData> => {
                    const { tags, templates } = await getTemplatesAndAllTags({
                        featured: true,
                    });

                    return {
                        allTags: tags,
                        templates,
                    };
                },
            },
            {
                id: 'templates_tags',
                path: 'templates/tags/:tag',
                async lazy() {
                    const { TemplatesPage } =
                        await import('./pages/templates-page/templates-page');
                    return {
                        element: <TemplatesPage />,
                    };
                },
                loader: async ({
                    params,
                }): Promise<TemplatesPageLoaderData> => {
                    const { tags, templates } = await getTemplatesAndAllTags({
                        tag: params.tag?.replace(/-/g, ' '),
                    });

                    return {
                        allTags: tags,
                        templates,
                    };
                },
            },
            {
                id: 'templates_templateSlug',
                path: 'templates/:templateSlug',
                async lazy() {
                    const { TemplatePage } =
                        await import('./pages/template-page/template-page');
                    return {
                        element: <TemplatePage />,
                    };
                },
                loader: async ({ params }): Promise<TemplatePageLoaderData> => {
                    const { templates } =
                        await import('./templates-data/templates-data');
                    return {
                        template: templates.find(
                            (template) => template.slug === params.templateSlug
                        ),
                    };
                },
            },
            {
                id: 'templates_load',
                path: 'templates/clone/:templateSlug',
                async lazy() {
                    const { CloneTemplatePage } =
                        await import('./pages/clone-template-page/clone-template-page');
                    return {
                        element: <CloneTemplatePage />,
                    };
                },
                loader: async ({ params }) => {
                    const { templates } =
                        await import('./templates-data/templates-data');
                    return {
                        template: templates.find(
                            (template) => template.slug === params.templateSlug
                        ),
                    };
                },
            },
            {
                path: 'admin',
                async lazy() {
                    const { AdminRoute } =
                        await import('./components/protected-route/admin-route');
                    const { AdminLayout } =
                        await import('./pages/admin/admin-layout');
                    return {
                        element: (
                            <AdminRoute>
                                <AdminLayout />
                            </AdminRoute>
                        ),
                    };
                },
                children: [
                    {
                        path: '',
                        async lazy() {
                            const { AdminDashboard } =
                                await import('./pages/admin/dashboard/admin-dashboard');
                            return { element: <AdminDashboard /> };
                        },
                    },
                    {
                        path: 'users',
                        async lazy() {
                            const { UsersList } =
                                await import('./pages/admin/users/users-list');
                            return { element: <UsersList /> };
                        },
                    },
                    {
                        path: 'audit',
                        async lazy() {
                            const { AuditLogs } =
                                await import('./pages/admin/audit/audit-logs');
                            return { element: <AuditLogs /> };
                        },
                    },
                ],
            },
            {
                path: '*',
                async lazy() {
                    const { NotFoundPage } =
                        await import('./pages/not-found-page/not-found-page');
                    return {
                        element: <NotFoundPage />,
                    };
                },
            },
        ],
    },
];

export const router = createBrowserRouter(routes);
