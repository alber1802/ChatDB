import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { TooltipProvider } from './components/tooltip/tooltip';
import { HelmetData } from './helmet/helmet-data';
import { HelmetProvider } from 'react-helmet-async';
import { LocalConfigProvider } from './context/local-config-context/local-config-provider';
import { ThemeProvider } from './context/theme-context/theme-provider';
import { AuthProvider } from './context/auth-context/auth-context';
import { Toaster } from 'sileo';

export const App = () => {
    return (
        <HelmetProvider>
            <HelmetData />
            <TooltipProvider>
                <LocalConfigProvider>
                    <ThemeProvider>
                        <AuthProvider>
                            <Toaster position="top-center" />
                            <RouterProvider router={router} />
                        </AuthProvider>
                    </ThemeProvider>
                </LocalConfigProvider>
            </TooltipProvider>
        </HelmetProvider>
    );
};
