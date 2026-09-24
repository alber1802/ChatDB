import React from 'react';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/avatar/avatar';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/lib/collaboration/share-helpers';

export const PersonAvatar: React.FC<{
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    size?: 'sm' | 'md';
}> = ({ name, email, avatarUrl, size = 'md' }) => (
    <Avatar className={cn(size === 'sm' ? 'size-6' : 'size-8')}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback
            className={cn(
                'font-medium',
                size === 'sm' ? 'text-[10px]' : 'text-xs'
            )}
        >
            {initialsOf(name, email)}
        </AvatarFallback>
    </Avatar>
);
