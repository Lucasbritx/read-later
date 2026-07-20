import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

const { unsubscribe } = vi.hoisted(() => ({
  unsubscribe: vi.fn()
}));

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe
          }
        }
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn()
    }
  }
}));

describe('App', () => {
  it('shows the auth form when signed out', async () => {
    render(<App />);

    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });
});
