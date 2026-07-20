// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { click, getButton, getInputByLabel, render, typeInto } from '../../test/render';
import { AuthForm } from './AuthForm';

describe('AuthForm', () => {
  it('submits sign in with email and password', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const onSignUp = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

    await typeInto(getInputByLabel(container, 'Email'), 'lucas@example.com');
    await typeInto(getInputByLabel(container, 'Password'), 'secret123');
    await click(getButton(container, 'Sign in'));

    expect(onSignIn).toHaveBeenCalledWith('lucas@example.com', 'secret123');
  });

  it('switches to sign up mode', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const onSignUp = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

    await click(getButton(container, 'Create account'));
    await typeInto(getInputByLabel(container, 'Email'), 'lucas@example.com');
    await typeInto(getInputByLabel(container, 'Password'), 'secret123');
    await click(getButton(container, 'Sign up'));

    expect(onSignUp).toHaveBeenCalledWith('lucas@example.com', 'secret123');
  });
});
