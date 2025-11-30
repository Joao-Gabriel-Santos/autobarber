import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } }
    }
  );

  const { data } = await supabase.auth.getUser();
  return data.user;
}
