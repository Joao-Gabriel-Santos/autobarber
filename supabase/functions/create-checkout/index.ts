import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { priceId, email, password, metadata } = await req.json();

    if (!priceId || !email || !password) {
      throw new Error('Dados incompletos');
    }

    console.log('Criando checkout session para:', email);

    // ✅ Criar sessão de checkout do Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'boleto'], // ⚠️ Aceita cartão E boleto
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      
      // ✅ URLs de redirecionamento
      success_url: `${req.headers.get('origin')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/signup?canceled=true`,
      
      customer_email: email,
      
      // ✅ Armazenar TODOS os dados no metadata
      metadata: {
        email,
        password, // ⚠️ Será recuperado no webhook
        full_name: metadata.full_name,
        whatsapp: metadata.whatsapp,
        barbershop_name: metadata.barbershop_name,
        selected_plan: metadata.selected_plan,
      },
      
      // ✅ Configurações específicas para boleto
      payment_method_options: {
        boleto: {
          expires_after_days: 3, // Boleto expira em 3 dias
        },
      },
      
      // ✅ IMPORTANTE: Permitir promoções/trial
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7, // 7 dias grátis
        metadata: {
          email,
          full_name: metadata.full_name,
          barbershop_name: metadata.barbershop_name,
        },
      },
    });

    console.log('Checkout session criada:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error: any) {
    console.error('Erro no create-checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});