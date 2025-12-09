// supabase/functions/create-checkout/index.ts

import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()

    console.log("Request body (sanitized):", {
      priceId: body.priceId,
      email: body.email,
      metadata: body.metadata,
    })

    // Validate required fields
    if (!body.priceId || !body.email) {
      throw new Error("Missing required fields: priceId or email")
    }

    if (!body.metadata) {
      throw new Error("Missing metadata")
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured")
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const origin = req.headers.get("origin") || new URL(req.url).origin

    console.log("Creating Stripe Checkout session...")

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

      // Send all metadata to Stripe (safe)
      metadata: {
        email: body.email,
        password: body.password, 
        ...body.metadata
      },

      subscription_data: {
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" }
        },
        trial_period_days: 7,
        metadata: {
          email: body.email,
          password: body.password,
          ...body.metadata,
        },
      },

      payment_method_options: {
        boleto: {
          expires_after_days: 3,
        }
      }
    })

    console.log("Checkout session created:", session.id)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (err) {
    console.error("Checkout error:", err)

    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
