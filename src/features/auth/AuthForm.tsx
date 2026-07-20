import { FormEvent, useState } from 'react';

type AuthMode = 'sign-in' | 'sign-up';

type AuthFormProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

export function AuthForm({ onSignIn, onSignUp }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignIn = mode === 'sign-in';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (isSignIn) {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setError('');
    setMode(isSignIn ? 'sign-up' : 'sign-in');
  };

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <p className="eyebrow">Read Later</p>
        <h1 id="auth-heading">{isSignIn ? 'Welcome back' : 'Create your account'}</h1>

        <form className="stack" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSignIn ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button className="text-button" type="button" onClick={toggleMode}>
          {isSignIn ? 'Create account' : 'Use existing account'}
        </button>
      </section>
    </main>
  );
}
