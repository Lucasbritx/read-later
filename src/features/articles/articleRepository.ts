import type { SupabaseClient } from '@supabase/supabase-js';

import type { Article, ArticleStatus, CreateArticleInput } from './articleTypes';

export async function listArticles(
  client: SupabaseClient,
  { userId, status }: { userId: string; status: ArticleStatus | 'all' }
): Promise<Article[]> {
  let query = client.from('articles').select('*').eq('user_id', userId);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Article[];
}

export async function createArticle(
  client: SupabaseClient,
  input: CreateArticleInput
): Promise<Article> {
  const { data, error } = await client
    .from('articles')
    .insert({
      user_id: input.userId,
      url: input.url,
      title: input.title,
      description: input.description,
      site_name: input.site_name,
      status: 'unread'
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Article;
}

export async function updateArticleStatus(
  client: SupabaseClient,
  {
    userId,
    articleId,
    status
  }: { userId: string; articleId: string; status: ArticleStatus }
): Promise<void> {
  const { error } = await client
    .from('articles')
    .update({
      status,
      read_at: status === 'read' ? new Date().toISOString() : null
    })
    .eq('user_id', userId)
    .eq('id', articleId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteArticle(
  client: SupabaseClient,
  { userId, articleId }: { userId: string; articleId: string }
): Promise<void> {
  const { error } = await client
    .from('articles')
    .delete()
    .eq('user_id', userId)
    .eq('id', articleId);

  if (error) {
    throw new Error(error.message);
  }
}
