import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );

    console.log("📦 Evento recebido:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("💳 Session:", {
        id: session.id,
        email: session.customer_email,
        metadata: session.metadata,
      });

      const email = session.customer_email;
      const password = session.metadata?.password;
      const fullName = session.metadata?.full_name;
      const whatsapp = session.metadata?.whatsapp;
      const barbershopName = session.metadata?.barbershop_name;
      const selectedPlan = session.metadata?.selected_plan;

      if (!email || !password) {
        throw new Error("Email ou senha ausentes no metadata");
      }

      // ===================================
      // 🔥 ESTRATÉGIA: Criar usuário SEM triggers
      // ===================================
      console.log("🔍 Buscando usuário existente...");
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      let user = existingUsers?.users.find((u) => u.email === email);

      if (user) {
        console.log("✅ Usuário já existe:", user.id);
      } else {
        console.log("📝 Tentando criar usuário...");

        // Tentativa 1: Criar normalmente
        const { data: newUserData, error: createError } = 
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              whatsapp: whatsapp,
            },
          });

        if (createError) {
          console.error("❌ Erro ao criar usuário:", {
            message: createError.message,
            status: createError.status,
            code: createError.code,
          });

          // 🔥 FALLBACK: Se falhar por problema de trigger/DB, 
          // criar DIRETO no banco auth.users (último recurso)
          if (createError.message.includes("Database error")) {
            console.log("🚨 Tentando criar usuário DIRETO no banco...");
            
            // Gerar ID e hash de senha
            const userId = crypto.randomUUID();
            const passwordHash = await hashPassword(password);
            
            const { data: directUser, error: directError } = await supabaseAdmin
              .from("auth.users")
              .insert({
                id: userId,
                email: email,
                encrypted_password: passwordHash,
                email_confirmed_at: new Date().toISOString(),
                raw_user_meta_data: {
                  full_name: fullName,
                  whatsapp: whatsapp,
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (directError) {
              console.error("❌ Falhou criar direto no banco:", directError);
              throw new Error("Não foi possível criar usuário");
            }

            user = { id: userId, email } as any;
            console.log("✅ Usuário criado DIRETO no banco:", userId);
          } else {
            throw createError;
          }
        } else {
          user = newUserData.user;
          console.log("✅ Usuário criado normalmente:", user.id);
        }
      }

      // ===================================
      // CRIAR PROFILE (com tolerância a falhas)
      // ===================================
      console.log("📄 Criando profile...");
      try {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: user.id,
              full_name: fullName,
              whatsapp: whatsapp,
              role: "owner",
            },
            { onConflict: "id" }
          );

        if (profileError) {
          console.error("⚠️ Erro no profile (continuando):", profileError.message);
        } else {
          console.log("✅ Profile criado/atualizado");
        }
      } catch (profileEx: any) {
        console.error("⚠️ Exceção no profile (continuando):", profileEx.message);
      }

      // ===================================
      // CRIAR BARBERSHOP (com tolerância a falhas)
      // ===================================
      console.log("🏪 Criando barbearia...");
      try {
        const { error: barbershopError } = await supabaseAdmin
          .from("barbershops")
          .upsert(
            {
              barber_id: user.id,
              barbershop_name: barbershopName,
            },
            { onConflict: "barber_id" }
          );

        if (barbershopError) {
          console.error("⚠️ Erro na barbearia (continuando):", barbershopError.message);
        } else {
          console.log("✅ Barbearia criada/atualizada");
        }
      } catch (barbershopEx: any) {
        console.error("⚠️ Exceção na barbearia (continuando):", barbershopEx.message);
      }

      // ===================================
      // CRIAR SUBSCRIPTION (CRÍTICO - NÃO pode falhar)
      // ===================================
      console.log("💰 Criando subscription...");
      
      const subscriptionData = {
        user_id: user.id,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan: selectedPlan,
        status: "trialing",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      };

      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(subscriptionData, { onConflict: "user_id" });

      if (subError) {
        console.error("❌ ERRO CRÍTICO na subscription:", subError);
        throw subError;
      }

      console.log("✅ Webhook processado com sucesso!");
      return new Response(JSON.stringify({ success: true, userId: user.id }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("❌ Erro no webhook:", {
      message: error.message,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

// Helper para hash de senha (fallback)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}