import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ArticleDashboard } from './ArticleDashboard';
import type { Article } from './articleTypes';

const articles: Article[] = [
  {
    id: 'article-1',
    user_id: 'user-1',
    url: 'https://example.com/first',
    title: 'First Article',
    description: 'A first article.',
    site_name: 'Example',
    status: 'unread',
    created_at: '2026-07-20T12:00:00.000Z',
    read_at: null
  },
  {
    id: 'article-2',
    user_id: 'user-1',
    url: 'https://example.com/second',
    title: 'Second Article',
    description: 'A second article.',
    site_name: 'Example',
    status: 'read',
    created_at: '2026-07-20T13:00:00.000Z',
    read_at: '2026-07-20T14:00:00.000Z'
  }
];

const renderDashboard = () => {
  const props = {
    articles,
    currentFilter: 'all' as const,
    isLoading: false,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    onFilterChange: vi.fn(),
    onSignOut: vi.fn(),
    onToggleStatus: vi.fn(),
    userEmail: 'lucas@example.com'
  };

  render(<ArticleDashboard {...props} />);

  return props;
};

describe('ArticleDashboard', () => {
  it('renders articles and unread count', () => {
    renderDashboard();

    expect(screen.getByText('First Article')).toBeInTheDocument();
    expect(screen.getByText('Second Article')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });

  it('marks an unread article read', async () => {
    const user = userEvent.setup();
    const { onToggleStatus } = renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Mark First Article read' }));

    expect(onToggleStatus).toHaveBeenCalledWith('article-1', 'read');
  });

  it('changes the active filter', async () => {
    const user = userEvent.setup();
    const { onFilterChange } = renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Read' }));

    expect(onFilterChange).toHaveBeenCalledWith('read');
  });
});
