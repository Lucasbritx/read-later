import { Check, LogOut, Trash2, Undo2 } from 'lucide-react';

import type { ArticleDraft } from '../../lib/urlMetadata';
import { ArticleForm } from './ArticleForm';
import type { Article, ArticleStatus } from './articleTypes';

export type ArticleFilter = ArticleStatus | 'all';

type ArticleDashboardProps = {
  articles: Article[];
  currentFilter: ArticleFilter;
  isLoading: boolean;
  onCreate: (draft: ArticleDraft) => Promise<void>;
  onActionError: (message: string) => void;
  onDelete: (articleId: string) => Promise<void>;
  onFilterChange: (filter: ArticleFilter) => void;
  onSignOut: () => Promise<void>;
  onToggleStatus: (articleId: string, status: ArticleStatus) => Promise<void>;
  userEmail: string;
};

const filters: { label: string; value: ArticleFilter }[] = [
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
  { label: 'All', value: 'all' }
];

export function ArticleDashboard({
  articles,
  currentFilter,
  isLoading,
  onCreate,
  onActionError,
  onDelete,
  onFilterChange,
  onSignOut,
  onToggleStatus,
  userEmail
}: ArticleDashboardProps) {
  const unreadCount = articles.filter((article) => article.status === 'unread').length;

  async function runDashboardAction(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      onActionError(error instanceof Error ? error.message : 'Action failed.');
    }
  }

  return (
    <main className="app-shell article-dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">Read Later</p>
          <h1>Article Library</h1>
          <p className="muted">{userEmail}</p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => void runDashboardAction(onSignOut)}
        >
          <LogOut aria-hidden="true" size={18} />
          Sign out
        </button>
      </header>

      <section className="dashboard-band" aria-labelledby="save-article-heading">
        <div>
          <h2 id="save-article-heading">Save an article</h2>
          <p className="muted">{unreadCount} unread</p>
        </div>

        <ArticleForm onCreate={onCreate} />
      </section>

      <section className="library-section" aria-labelledby="article-library-heading">
        <div className="library-section-header">
          <h2 id="article-library-heading">Library</h2>
          <div className="filter-row" role="group" aria-label="Article filters">
            {filters.map((filter) => (
              <button
                className={`filter-button${currentFilter === filter.value ? ' active' : ''}`}
                type="button"
                key={filter.value}
                onClick={() => onFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <p className="muted">Loading articles...</p> : null}

        {!isLoading && articles.length === 0 ? (
          <p className="empty-state">No articles in this view yet.</p>
        ) : null}

        {!isLoading && articles.length > 0 ? (
          <ul className="article-list">
            {articles.map((article) => {
              const nextStatus: ArticleStatus = article.status === 'unread' ? 'read' : 'unread';
              const ToggleIcon = nextStatus === 'read' ? Check : Undo2;

              return (
                <li className="article-item" key={article.id}>
                  <div className="article-copy">
                    <a href={article.url} target="_blank" rel="noreferrer">
                      {article.title}
                    </a>
                    <p>{article.site_name}</p>
                    {article.description ? <p>{article.description}</p> : null}
                  </div>

                  <div className="article-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Mark ${article.title} ${nextStatus}`}
                      onClick={() =>
                        void runDashboardAction(() => onToggleStatus(article.id, nextStatus))
                      }
                    >
                      <ToggleIcon aria-hidden="true" size={18} />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label={`Delete ${article.title}`}
                      onClick={() => void runDashboardAction(() => onDelete(article.id))}
                    >
                      <Trash2 aria-hidden="true" size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
