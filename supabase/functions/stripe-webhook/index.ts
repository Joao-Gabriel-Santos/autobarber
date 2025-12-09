// supabase/functions/stripe-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@13.3.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log(`Webhook received: ${event.type}`)

    // Mapear plano baseado no price_id
    const getPlanFromPriceId = (priceId: string): string => {
      const priceStarter = Deno.env.get('STRIPE_PRICE_STARTER')
      const pricePro = Deno.env.get('STRIPE_PRICE_PRO')
      const priceMaster = Deno.env.get('STRIPE_PRICE_MASTER')

      if (priceId === priceStarter) return 'starter'
      if (priceId === pricePro) return 'pro'
      if (priceId === priceMaster) return 'master'
      return 'pro' // default
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        console.log('Processing checkout.session.completed')
        console.log('Session metadata:', session.metadata)

        // Extrair dados do metadata
        const email = session.metadata?.email || session.customer_email
        const password = session.metadata?.password
        const fullName = session.metadata?.full_name
        const whatsapp = session.metadata?.whatsapp
        const barbershopName = session.metadata?.barbershop_name
        const selectedPlan = session.metadata?.selected_plan

        if (!email || !password) {
          console.error('Missing email or password in metadata')
          break
        }

        // 1️⃣ CRIAR USUÁRIO NO AUTH
        console.log('Creating user:', email)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // ✅ Confirmar email automaticamente
          user_metadata: {
            full_name: fullName,
            whatsapp: whatsapp,
            barbershop_name: barbershopName,
            selected_plan: selectedPlan,
          }
        })

        if (authError) {
          console.error('Error creating user:', authError)
          // Se o usuário já existe, buscar pelo email
          const { data: existingUser, error: fetchError } = await supabase.auth.admin.listUsers()
          const user = existingUser?.users.find(u => u.email === email)
          
          if (!user) {
            throw new Error('Failed to create or find user')
          }
          
          console.log('User already exists:', user.id)
          
          // Continuar com o usuário existente
          await createProfileAndSubscription(user.id, session, fullName, whatsapp, barbershopName, selectedPlan)
        } else {
          console.log('User created:', authData.user.id)
          
          // 2️⃣ CRIAR PROFILE E SUBSCRIPTION
          await createProfileAndSubscription(authData.user.id, session, fullName, whatsapp, barbershopName, selectedPlan)
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0].price.id
        const plan = getPlanFromPriceId(priceId)

        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan: plan,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription:', error)
        } else {
          console.log(`Subscription ${subscription.id} updated`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error canceling subscription:', error)
        } else {
          console.log(`Subscription ${subscription.id} canceled`)
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    )
  }
})

// Função auxiliar para criar profile, barbershop e subscription
async function createProfileAndSubscription(
  userId: string,
  session: Stripe.Checkout.Session,
  fullName: string | undefined,
  whatsapp: string | undefined,
  barbershopName: string | undefined,
  selectedPlan: string | undefined
) {
  // Buscar a subscription
  const subscriptionId = session.subscription as string
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0].price.id
  
  const getPlanFromPriceId = (priceId: string): string => {
    const priceStarter = Deno.env.get('STRIPE_PRICE_STARTER')
    const pricePro = Deno.env.get('STRIPE_PRICE_PRO')
    const priceMaster = Deno.env.get('STRIPE_PRICE_MASTER')

    if (priceId === priceStarter) return 'starter'
    if (priceId === pricePro) return 'pro'
    if (priceId === priceMaster) return 'master'
    return 'pro'
  }
  
  const plan = getPlanFromPriceId(priceId)

  // 3️⃣ CRIAR PROFILE
  console.log('Creating profile for user:', userId)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: fullName || '',
      whatsapp: whatsapp || '',
    }, {
      onConflict: 'id'
    })

  if (profileError) {
    console.error('Error creating profile:', profileError)
  }

  // 4️⃣ CRIAR BARBERSHOP
  console.log('Creating barbershop for user:', userId)
  const { error: barbershopError } = await supabase
    .from('barbershops')
    .upsert({
      barber_id: userId,
      barbershop_name: barbershopName || 'Minha Barbearia',
    }, {
      onConflict: 'barber_id'
    })

  if (barbershopError) {
    console.error('Error creating barbershop:', barbershopError)
  }

  // 5️⃣ CRIAR SUBSCRIPTION
  console.log('Creating subscription for user:', userId)
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      plan: plan,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }, {
      onConflict: 'stripe_subscription_id'
    })

  if (subscriptionError) {
    console.error('Error creating subscription:', subscriptionError)
  } else {
    console.log(`✅ User ${userId} fully created with subscription ${subscriptionId}`)
  }
}