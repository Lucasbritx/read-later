// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { click, getButton, getByText, render, waitFor } from '../../test/render';
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

function renderDashboard() {
  const props = {
    articles,
    currentFilter: 'all' as const,
    isLoading: false,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onActionError: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onFilterChange: vi.fn(),
    onSignOut: vi.fn().mockResolvedValue(undefined),
    onToggleStatus: vi.fn().mockResolvedValue(undefined),
    userEmail: 'lucas@example.com'
  };

  const view = render(<ArticleDashboard {...props} />);

  return { ...props, ...view };
}

describe('ArticleDashboard', () => {
  it('renders articles and unread count', () => {
    const { container } = renderDashboard();

    expect(getByText(container, 'First Article')).toBeTruthy();
    expect(getByText(container, 'Second Article')).toBeTruthy();
    expect(getByText(container, '1 unread')).toBeTruthy();
  });

  it('marks an unread article read', async () => {
    const { container, onToggleStatus } = renderDashboard();

    await click(getButton(container, 'Mark First Article read'));

    expect(onToggleStatus).toHaveBeenCalledWith('article-1', 'read');
  });

  it('changes the active filter', async () => {
    const { container, onFilterChange } = renderDashboard();

    await click(getButton(container, 'Read'));

    expect(onFilterChange).toHaveBeenCalledWith('read');
  });

  it('reports failed dashboard actions', async () => {
    const { container, onActionError, onToggleStatus } = renderDashboard();
    onToggleStatus.mockRejectedValueOnce(new Error('Could not update article.'));

    await click(getButton(container, 'Mark First Article read'));

    await waitFor(() => {
      expect(onActionError).toHaveBeenCalledWith('Could not update article.');
    });
  });
});
