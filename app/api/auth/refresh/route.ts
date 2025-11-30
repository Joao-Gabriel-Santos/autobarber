import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get('sb-refresh-token')?.value;

  if (!refresh) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refresh
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const access = data.session?.access_token;
  const newRefresh = data.session?.refresh_token;

  cookieStore.set('sb-access-token', access!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });

  cookieStore.set('sb-refresh-token', newRefresh!, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });

  return NextResponse.json({ ok: true });
}
