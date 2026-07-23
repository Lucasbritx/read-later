// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { click, getButton, getByText, render, typeInto, waitFor } from '../../test/render';
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

function renderDashboard(overrides: Partial<Parameters<typeof ArticleDashboard>[0]> = {}) {
  const props = {
    articles,
    currentFilter: 'all' as const,
    kindleEmail: 'reader@kindle.com',
    isLoading: false,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onActionError: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onFilterChange: vi.fn(),
    onSaveKindleEmail: vi.fn().mockResolvedValue(undefined),
    onSendToKindle: vi.fn().mockResolvedValue(undefined),
    onSignOut: vi.fn().mockResolvedValue(undefined),
    onToggleStatus: vi.fn().mockResolvedValue(undefined),
    sendingArticleIds: [],
    userEmail: 'lucas@example.com'
  };

  const view = render(<ArticleDashboard {...props} {...overrides} />);

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

  it('saves a Kindle email', async () => {
    const { container, onSaveKindleEmail } = renderDashboard();
    const input = container.querySelector<HTMLInputElement>('#kindle-email');

    if (!input) {
      throw new Error('Could not find Kindle email input.');
    }

    await typeInto(input, 'new-reader@kindle.com');
    await click(getButton(container, 'Save Kindle email'));

    expect(onSaveKindleEmail).toHaveBeenCalledWith('new-reader@kindle.com');
  });

  it('sends an article to Kindle', async () => {
    const { container, onSendToKindle } = renderDashboard();

    await click(getButton(container, 'Send First Article to Kindle'));

    expect(onSendToKindle).toHaveBeenCalledWith('article-1');
  });

  it('disables an article Kindle action while sending', () => {
    const { container } = renderDashboard({ sendingArticleIds: ['article-1'] });
    const button = getButton(container, 'Sending First Article to Kindle') as HTMLButtonElement;

    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
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
