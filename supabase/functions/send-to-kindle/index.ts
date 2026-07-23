import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  handleSendToKindleRequest,
  type SendToKindleDependencies
} from './sendToKindleCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const senderEmail = Deno.env.get('KINDLE_SENDER_EMAIL') ?? '';

function createAuthorizedClient(authorizationHeader: string | null) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authorizationHeader ? { Authorization: authorizationHeader } : {}
    }
  });
}

function createDependencies(request: Request): SendToKindleDependencies {
  const authorizationHeader = request.headers.get('Authorization');

  return {
    senderEmail,
    async getUser(request) {
      const client = createAuthorizedClient(request.headers.get('Authorization'));
      const { data, error } = await client.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email
      };
    },
    async getArticle(userId, articleId) {
      const client = createAuthorizedClient(authorizationHeader);
      const { data, error } = await client
        .from('articles')
        .select('id,user_id,title,url,description,site_name')
        .eq('user_id', userId)
        .eq('id', articleId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    async getKindleSettings(userId) {
      const client = createAuthorizedClient(authorizationHeader);
      const { data, error } = await client
        .from('kindle_settings')
        .select('user_id,kindle_email')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    async sendEmail(payload) {
      if (!resendApiKey || !senderEmail) {
        throw new Error('Send to Kindle email is not configured.');
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw await response.text();
      }
    }
  };
}

Deno.serve((request) => {
  const deps = createDependencies(request);

  return handleSendToKindleRequest(request, deps);
});
