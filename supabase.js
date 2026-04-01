import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const supabaseUrl = "https://oxownfzafrveihxhuxay.supabase.co"

const supabaseKey =
"sb_publishable_qu_7OLWgfKpbmKnzDsQOuA_SUhryH67"

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)
