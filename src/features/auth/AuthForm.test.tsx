import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthForm } from './AuthForm';

describe('AuthForm', () => {
  it('submits email and password for sign in', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const onSignUp = vi.fn().mockResolvedValue(undefined);

    render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

    await user.type(screen.getByLabelText('Email'), 'lucas@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSignIn).toHaveBeenCalledWith('lucas@example.com', 'secret123');
  });

  it('switches to sign up and submits email and password', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const onSignUp = vi.fn().mockResolvedValue(undefined);

    render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Email'), 'lucas@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(onSignUp).toHaveBeenCalledWith('lucas@example.com', 'secret123');
  });
});
