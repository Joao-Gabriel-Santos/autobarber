// supabase/functions/create-checkout/index.ts

import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  priceId: string
  userId: string
  email: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse body
    const body: RequestBody = await req.json()
    console.log('Request received:', { priceId: body.priceId, userId: body.userId, email: body.email })

    // Validate
    if (!body.priceId || !body.userId || !body.email) {
      throw new Error('Missing required fields: priceId, userId, or email')
    }

    // Get Stripe key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    console.log('Creating checkout session...')

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${new URL(req.url).origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(req.url).origin}/signup`,
      customer_email: body.email,
      client_reference_id: body.userId,
      metadata: {
        userId: body.userId,
      },
      subscription_data: {
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
        trial_period_days: 7,
        metadata: {
          userId: body.userId,
        },
      },
    })

    console.log('Session created:', session.id)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})