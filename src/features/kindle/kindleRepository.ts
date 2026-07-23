import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  KindleSettings,
  SaveKindleSettingsInput,
  SendToKindleResult
} from './kindleTypes';

export function validateKindleEmail(value: string): boolean {
  return /^[^\s@]+@(free\.)?kindle\.com$/i.test(value.trim());
}

export async function getKindleSettings(
  client: SupabaseClient,
  userId: string
): Promise<KindleSettings | null> {
  const { data, error } = await client
    .from('kindle_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as KindleSettings | null;
}

export async function saveKindleSettings(
  client: SupabaseClient,
  input: SaveKindleSettingsInput
): Promise<KindleSettings> {
  const kindleEmail = input.kindleEmail.trim();

  if (!validateKindleEmail(kindleEmail)) {
    throw new Error('Enter a valid Kindle email address.');
  }

  const { data, error } = await client
    .from('kindle_settings')
    .upsert({
      user_id: input.userId,
      kindle_email: kindleEmail
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Could not save Kindle settings.');
  }

  return data as KindleSettings;
}

export async function sendArticleToKindle(
  client: SupabaseClient,
  articleId: string
): Promise<SendToKindleResult> {
  const { data, error } = await client.functions.invoke('send-to-kindle', {
    body: { articleId }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as SendToKindleResult;
}
