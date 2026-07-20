import { FormEvent, useState } from 'react';

import { buildArticleDraft, type ArticleDraft } from '../../lib/urlMetadata';

type ArticleFormProps = {
  onCreate: (draft: ArticleDraft) => Promise<void>;
};

export function ArticleForm({ onCreate }: ArticleFormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const draft = buildArticleDraft(url);
      await onCreate(draft);
      setUrl('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save article.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="article-form" onSubmit={handleSubmit}>
      <label htmlFor="article-url">
        Article URL
        <input
          id="article-url"
          type="text"
          placeholder="https://example.com/article"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </label>

      <button className="primary-button" type="submit" disabled={isSubmitting}>
        Save article
      </button>

      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
