import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password, full_name, phone } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    // Cria usuário no Supabase Auth com metadata
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name, phone },
      email_confirm: true, // para pular confirmação se quiser
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data }, { status: 200 });
  } catch (err) {
    console.error('Erro no endpoint register:', err);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
