import { createClient } from '@supabase/supabase-js';

import { getAppEnv } from './env';

const env = getAppEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
