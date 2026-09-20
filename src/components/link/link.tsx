import { cn } from '@/lib/utils';
import React from 'react';

export const Link = React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, children, ...props }, ref) => (
    <a
        ref={ref}
        className={cn('text-primary hover:underline', className)}
        {...props}
    >
        {children}
    </a>
));

Link.displayName = 'Link';
