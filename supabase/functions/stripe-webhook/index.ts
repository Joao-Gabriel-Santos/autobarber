import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0"; 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  // O Deno já injeta o FetchAPI, o httpClient é opcional, mas manter é OK.
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
    
    // 🚀 CORREÇÃO PRINCIPAL: Usar constructEventAsync para Deno/Edge Functions
    const event = await stripe.webhooks.constructEventAsync( 
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );

    console.log("📦 Evento recebido:", event.type);

    // Restante da sua lógica permanece a mesma...
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("💳 Session ID:", session.id);
      console.log("📧 Email:", session.customer_email);
      console.log("📦 Metadata:", session.metadata);

      // ===================================
      // 1️⃣ BUSCAR OU CRIAR USUÁRIO
      // ===================================
      const email = session.customer_email;
      const password = session.metadata?.password; // Enviado do frontend
      const fullName = session.metadata?.full_name;
      const whatsapp = session.metadata?.whatsapp;
      const barbershopName = session.metadata?.barbershop_name;
      const selectedPlan = session.metadata?.selected_plan;

      if (!email || !password) {
        throw new Error("Email ou senha ausentes no metadata");
      }

      console.log("🔍 Verificando se usuário já existe...");

      // Tentar buscar usuário existente pelo email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      let user = existingUsers?.users.find((u) => u.email === email);

      if (user) {
        console.log("✅ Usuário já existe:", user.id);
      } else {
        console.log("📝 Criando novo usuário...");

        // Criar usuário APENAS se não existir
        const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // ✅ Confirmar email automaticamente
          user_metadata: {
            full_name: fullName,
            whatsapp: whatsapp,
          },
        });

        if (createError) {
          // Se erro for de duplicação, buscar o usuário novamente
          if (createError.message.includes("duplicate") || createError.message.includes("already exists")) {
            console.log("⚠️ Usuário já existe (race condition), buscando novamente...");
            const { data: retryUsers } = await supabaseAdmin.auth.admin.listUsers();
            user = retryUsers?.users.find((u) => u.email === email);
            
            if (!user) {
              throw new Error("Não foi possível encontrar ou criar usuário");
            }
          } else {
            throw createError;
          }
        } else {
          user = newUserData.user;
          console.log("✅ Usuário criado com sucesso:", user.id);
        }
      }

      // ===================================
      // 2️⃣ CRIAR/ATUALIZAR PROFILE
      // ===================================
      console.log("📄 Criando/atualizando profile...");

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName,
          whatsapp: whatsapp,
          role: "owner",
        });

      if (profileError) {
        console.error("❌ Erro no profile:", profileError);
        throw profileError;
      }

      // ===================================
      // 3️⃣ CRIAR BARBERSHOP
      // ===================================
      console.log("🏪 Criando barbearia...");

      const { error: barbershopError } = await supabaseAdmin
        .from("barbershops")
        .upsert({
          barber_id: user.id,
          barbershop_name: barbershopName,
        });

      if (barbershopError) {
        console.error("❌ Erro na barbearia:", barbershopError);
        throw barbershopError;
      }

      // ===================================
      // 4️⃣ CRIAR SUBSCRIPTION
      // ===================================
      console.log("💰 Criando subscription...");

      const subscriptionData = {
        user_id: user.id,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan: selectedPlan,
        status: "trialing", // 7 dias grátis
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      };

      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(subscriptionData);

      if (subError) {
        console.error("❌ Erro na subscription:", subError);
        throw subError;
      }

      console.log("✅ Webhook processado com sucesso!");
      return new Response(JSON.stringify({ success: true }), {
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
      details: error,
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