import Stripe from 'https://esm.sh/stripe@15'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  priceId: string;
  email: string;
  password: string;
  metadata: {
    full_name: string;
    whatsapp: string;
    barbershop_name: string;
    selected_plan: string;
  };
}

Deno.serve(async (req: Request) => {
  // ✅ Permitir OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()

    console.log("📦 Request body recebido (sanitized):", {
      priceId: body.priceId,
      email: body.email,
      hasPassword: !!body.password,
      passwordLength: body.password?.length,
      metadata: body.metadata,
    })

    // Validar campos obrigatórios
    if (!body.priceId || !body.email) {
      console.error("❌ Campos obrigatórios ausentes");
      throw new Error("Missing required fields: priceId or email")
    }

    if (!body.password) {
      console.error("❌ Senha ausente");
      throw new Error("Password is required")
    }

    if (!body.metadata) {
      console.error("❌ Metadata ausente");
      throw new Error("Missing metadata")
    }

    // Validar todos os campos do metadata
    const requiredMetadata = ['full_name', 'whatsapp', 'barbershop_name', 'selected_plan'];
    for (const field of requiredMetadata) {
      if (!body.metadata[field as keyof typeof body.metadata]) {
        console.error(`❌ Campo ${field} ausente no metadata`);
        throw new Error(`Missing metadata field: ${field}`);
      }
    }

    console.log("✅ Validação completa");

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.error("❌ STRIPE_SECRET_KEY não configurada");
      throw new Error("STRIPE_SECRET_KEY not configured")
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const origin = req.headers.get("origin") || new URL(req.url).origin

    console.log("🔧 Criando sessão Stripe com metadata:", {
      email: body.email,
      metadata: {
        ...body.metadata,
        email: body.email,
        password: '[HIDDEN]'
      }
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "boleto"],
      mode: "subscription",
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup`,
      customer_email: body.email,

      // CRÍTICO: Incluir senha no metadata
      metadata: {
        email: body.email,
        password: body.password,
        full_name: body.metadata.full_name,
        whatsapp: body.metadata.whatsapp,
        barbershop_name: body.metadata.barbershop_name,
        selected_plan: body.metadata.selected_plan,
      },

      subscription_data: {
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" }
        },
        trial_period_days: 7,
        metadata: {
          email: body.email,
          password: body.password,
          full_name: body.metadata.full_name,
          whatsapp: body.metadata.whatsapp,
          barbershop_name: body.metadata.barbershop_name,
          selected_plan: body.metadata.selected_plan,
        },
      },

      payment_method_options: {
        boleto: {
          expires_after_days: 3,
        }
      }
    })

    console.log("✅ Sessão criada:", session.id)
    console.log("🔗 URL:", session.url)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (err) {
    console.error("❌ Erro ao criar checkout:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      details: err
    })

    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : "Unknown error",
        details: err instanceof Error ? err.toString() : "No details"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})