import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { ArticleDashboard, type ArticleFilter } from './features/articles/ArticleDashboard';
import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticleStatus
} from './features/articles/articleRepository';
import type { Article, ArticleStatus } from './features/articles/articleTypes';
import { AuthForm } from './features/auth/AuthForm';
import type { ArticleDraft } from './lib/urlMetadata';
import { supabase } from './lib/supabaseClient';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [filter, setFilter] = useState<ArticleFilter>('unread');
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [notice, setNotice] = useState('');

  const userId = session?.user.id;

  const refreshArticles = useCallback(async () => {
    if (!userId) {
      setArticles([]);
      return;
    }

    setIsLoadingArticles(true);
    setNotice('');

    try {
      const nextArticles = await listArticles(supabase, { userId, status: filter });
      setArticles(nextArticles);
    } catch (error) {
      setNotice(getErrorMessage(error, 'Could not load articles.'));
    } finally {
      setIsLoadingArticles(false);
    }
  }, [filter, userId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsBooting(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshArticles();
  }, [refreshArticles]);

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      throw new Error(error.message);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    setArticles([]);
  };

  const handleCreateArticle = async (draft: ArticleDraft) => {
    if (!userId) {
      return;
    }

    setNotice('');
    await createArticle(supabase, { userId, ...draft });
    await refreshArticles();
  };

  const handleToggleStatus = async (articleId: string, status: ArticleStatus) => {
    if (!userId) {
      return;
    }

    setNotice('');
    await updateArticleStatus(supabase, { userId, articleId, status });
    await refreshArticles();
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!userId) {
      return;
    }

    setNotice('');
    await deleteArticle(supabase, { userId, articleId });
    await refreshArticles();
  };

  if (isBooting) {
    return <main className="app-shell">Loading...</main>;
  }

  if (!session) {
    return <AuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} />;
  }

  return (
    <>
      <ArticleDashboard
        articles={articles}
        currentFilter={filter}
        isLoading={isLoadingArticles}
        onCreate={handleCreateArticle}
        onDelete={handleDeleteArticle}
        onFilterChange={setFilter}
        onSignOut={handleSignOut}
        onToggleStatus={handleToggleStatus}
        userEmail={session.user.email ?? 'Signed in'}
      />
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </>
  );
}
