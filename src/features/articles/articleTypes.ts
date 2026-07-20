export type ArticleStatus = 'unread' | 'read';

export type Article = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  description: string;
  site_name: string;
  status: ArticleStatus;
  created_at: string;
  read_at: string | null;
};

export type CreateArticleInput = {
  userId: string;
  url: string;
  title: string;
  description: string;
  site_name: string;
};
