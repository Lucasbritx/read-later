import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ArticleForm } from './ArticleForm';

describe('ArticleForm', () => {
  it('submits an article draft with normalized URL metadata', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<ArticleForm onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Article URL'), 'example.com/story');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(onCreate).toHaveBeenCalledWith({
      url: 'https://example.com/story',
      title: 'example.com',
      description: '',
      site_name: 'example.com'
    });
  });

  it('shows an error for invalid URLs without submitting', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<ArticleForm onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Article URL'), 'bad url');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(screen.getByText('Enter a valid article URL.')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
