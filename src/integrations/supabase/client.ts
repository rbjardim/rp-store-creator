import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL = "https://silkmdysmkrjrhpbdtud.supabase.co"
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YismHoWe8YK0-QwPX3mrVQ_bsabujH8"

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
)