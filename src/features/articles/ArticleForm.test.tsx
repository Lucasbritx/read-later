// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { click, getButton, getByText, getInputByLabel, render, typeInto } from '../../test/render';
import { ArticleForm } from './ArticleForm';

describe('ArticleForm', () => {
  it('submits a normalized article draft', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ArticleForm onCreate={onCreate} />);

    await typeInto(getInputByLabel(container, 'Article URL'), 'example.com/story');
    await click(getButton(container, 'Save article'));

    expect(onCreate).toHaveBeenCalledWith({
      url: 'https://example.com/story',
      title: 'example.com',
      description: '',
      site_name: 'example.com'
    });
  });

  it('shows validation feedback for invalid urls', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ArticleForm onCreate={onCreate} />);

    await typeInto(getInputByLabel(container, 'Article URL'), 'bad url');
    await click(getButton(container, 'Save article'));

    expect(getByText(container, 'Enter a valid article URL.')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
