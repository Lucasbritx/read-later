import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ArticleDashboard, type ArticleFilter } from './features/articles/ArticleDashboard';
import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticleStatus
} from './features/articles/articleRepository';
import type { Article, ArticleStatus } from './features/articles/articleTypes';
import { AuthForm } from './features/auth/AuthForm';
import {
  getKindleSettings,
  saveKindleSettings,
  sendArticleToKindle
} from './features/kindle/kindleRepository';
import type { KindleSettings } from './features/kindle/kindleTypes';
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
  const [kindleSettings, setKindleSettings] = useState<KindleSettings | null>(null);
  const [notice, setNotice] = useState('');
  const [sendingArticleIds, setSendingArticleIds] = useState<string[]>([]);
  const refreshRequestId = useRef(0);
  const kindleSaveRequestId = useRef(0);
  const sessionUserIdRef = useRef<string | undefined>(undefined);

  const userId = session?.user.id;

  useEffect(() => {
    sessionUserIdRef.current = userId;
  }, [userId]);

  const refreshArticles = useCallback(async () => {
    if (!userId) {
      refreshRequestId.current += 1;
      setArticles([]);
      setIsLoadingArticles(false);
      return;
    }

    const requestId = refreshRequestId.current + 1;
    refreshRequestId.current = requestId;
    setIsLoadingArticles(true);
    setNotice('');

    try {
      const nextArticles = await listArticles(supabase, { userId, status: filter });

      if (refreshRequestId.current === requestId) {
        setArticles(nextArticles);
      }
    } catch (error) {
      if (refreshRequestId.current === requestId) {
        setNotice(getErrorMessage(error, 'Could not load articles.'));
      }
    } finally {
      if (refreshRequestId.current === requestId) {
        setIsLoadingArticles(false);
      }
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
      const nextUserId = nextSession?.user.id;
      sessionUserIdRef.current = nextUserId;
      kindleSaveRequestId.current += 1;

      if (!nextUserId) {
        setKindleSettings(null);
        setSendingArticleIds([]);
      }

      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshArticles();
  }, [refreshArticles]);

  useEffect(() => {
    if (!userId) {
      setKindleSettings(null);
      setSendingArticleIds([]);
      kindleSaveRequestId.current += 1;
      return;
    }

    const requestUserId = userId;
    const requestId = kindleSaveRequestId.current + 1;
    kindleSaveRequestId.current = requestId;
    let isCurrent = true;

    getKindleSettings(supabase, requestUserId)
      .then((settings) => {
        if (
          isCurrent &&
          kindleSaveRequestId.current === requestId &&
          sessionUserIdRef.current === requestUserId
        ) {
          setKindleSettings(settings);
        }
      })
      .catch((error) => {
        if (
          isCurrent &&
          kindleSaveRequestId.current === requestId &&
          sessionUserIdRef.current === requestUserId
        ) {
          setNotice(getErrorMessage(error, 'Could not load Kindle settings.'));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

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
    const currentUserId = userId;
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    if (sessionUserIdRef.current === currentUserId) {
      sessionUserIdRef.current = undefined;
    }

    kindleSaveRequestId.current += 1;
    refreshRequestId.current += 1;
    setArticles([]);
    setKindleSettings(null);
    setSendingArticleIds([]);
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

  const handleSaveKindleEmail = async (kindleEmail: string) => {
    if (!userId) {
      return;
    }

    const requestUserId = userId;
    const requestId = kindleSaveRequestId.current + 1;
    kindleSaveRequestId.current = requestId;
    setNotice('');
    const nextSettings = await saveKindleSettings(supabase, { userId: requestUserId, kindleEmail });

    if (kindleSaveRequestId.current === requestId && sessionUserIdRef.current === requestUserId) {
      setKindleSettings(nextSettings);
      setNotice('Kindle email saved.');
    }
  };

  const handleSendToKindle = async (articleId: string) => {
    if (!userId) {
      return;
    }

    if (!kindleSettings) {
      setNotice('Save your Kindle email before sending.');
      return;
    }

    setNotice('');
    setSendingArticleIds((current) =>
      current.includes(articleId) ? current : [...current, articleId]
    );

    const requestUserId = userId;

    try {
      await sendArticleToKindle(supabase, articleId);

      if (sessionUserIdRef.current === requestUserId) {
        setNotice('Sent to Kindle.');
      }
    } finally {
      if (sessionUserIdRef.current === requestUserId) {
        setSendingArticleIds((current) => current.filter((id) => id !== articleId));
      }
    }
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
        kindleEmail={kindleSettings?.kindle_email ?? ''}
        onCreate={handleCreateArticle}
        onDelete={handleDeleteArticle}
        onActionError={setNotice}
        onFilterChange={setFilter}
        onSaveKindleEmail={handleSaveKindleEmail}
        onSendToKindle={handleSendToKindle}
        onSignOut={handleSignOut}
        onToggleStatus={handleToggleStatus}
        sendingArticleIds={sendingArticleIds}
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
