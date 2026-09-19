import type {} from '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table } from 'lucide-react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
    it('renders the given icon instead of the old illustration image', () => {
        render(
            <EmptyState
                icon={Table}
                title="No tables yet"
                description="Create a table to get started"
            />
        );
        expect(screen.getByText('No tables yet')).toBeInTheDocument();
        expect(
            screen.getByText('Create a table to get started')
        ).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
