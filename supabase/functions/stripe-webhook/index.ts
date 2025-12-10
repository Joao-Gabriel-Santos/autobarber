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
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    console.log(`🎯 Webhook received: ${event.type}`)

    // Mapear plano baseado no price_id
    const getPlanFromPriceId = (priceId: string): string => {
      const priceStarter = Deno.env.get('STRIPE_PRICE_STARTER')
      const pricePro = Deno.env.get('STRIPE_PRICE_PRO')
      const priceMaster = Deno.env.get('STRIPE_PRICE_MASTER')

      if (priceId === priceStarter) return 'starter'
      if (priceId === pricePro) return 'pro'
      if (priceId === priceMaster) return 'master'
      return 'pro'
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        console.log('📋 Processing checkout.session.completed')
        console.log('Session ID:', session.id)
        console.log('Session metadata:', session.metadata)

        // Extrair dados do metadata
        const email = session.metadata?.email || session.customer_email
        const password = session.metadata?.password
        const fullName = session.metadata?.full_name
        const whatsapp = session.metadata?.whatsapp
        const barbershopName = session.metadata?.barbershop_name
        const selectedPlan = session.metadata?.selected_plan

        if (!email || !password) {
          console.error('❌ Missing email or password in metadata')
          break
        }

        console.log('📧 Email:', email)
        console.log('👤 Full name:', fullName)

        // 1️⃣ VERIFICAR SE USUÁRIO JÁ EXISTE
        console.log('🔍 Checking if user already exists...')

        const { data: listData, error: listError } = await supabase.auth.admin.listUsers({filter: `email eq "${email}"`, perPage: 1})
        
        if (listError) {
          console.error('❌ Error checking user existence:', listError)
          throw new Error('Failed to check user existence: ' + listError.message)
        }
        
        const existingUser = listData.users.length > 0 ? listData.users[0] : null

        if (existingUser) {
          console.log('⚠️ User already exists:', existingUser.id)
          console.log('Email confirmed:', existingUser.email_confirmed_at)
          
          // Se já existe, apenas criar/atualizar subscription
          await createProfileAndSubscription(
            existingUser.id, 
            session, 
            fullName, 
            whatsapp, 
            barbershopName, 
            selectedPlan
          )
        } else {
          // 2️⃣ CRIAR NOVO USUÁRIO (SEM CONFIRMAR EMAIL - enviar email de confirmação)
          console.log('👤 Creating new user (with email confirmation)...')
          
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // ❌ NÃO confirmar automaticamente
            user_metadata: {
              full_name: fullName,
              whatsapp: whatsapp,
              barbershop_name: barbershopName,
              selected_plan: selectedPlan,
            },
            app_metadata: {
              provider: 'email'
            }
          })

          // Enviar email de confirmação manualmente
    if (authData?.user) {
      console.log('2.1. Enviando email de confirmação...');
      const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email,
      });
      
      if (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }
    }

          // 3️⃣ ENVIAR EMAIL DE CONFIRMAÇÃO MANUALMENTE (caso não tenha sido enviado)
          try {
            console.log('📧 Sending confirmation email...')
            
            // Usar a API do Supabase para reenviar email de confirmação
            const { error: emailError } = await supabase.auth.admin.generateLink({
              type: 'magiclink',
              email: email,
            })

            if (emailError) {
              console.error('⚠️ Error sending confirmation email:', emailError)
            } else {
              console.log('✅ Confirmation email sent')
            }
          } catch (emailError) {
            console.error('⚠️ Failed to send confirmation email:', emailError)
          }

          // 4️⃣ CRIAR PROFILE E SUBSCRIPTION (mesmo sem email confirmado)
          await createProfileAndSubscription(
            authData.user.id, 
            session, 
            fullName, 
            whatsapp, 
            barbershopName, 
            selectedPlan
          )
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0].price.id
        const plan = getPlanFromPriceId(priceId)

        console.log('🔄 Updating subscription:', subscription.id)

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
          console.error('❌ Error updating subscription:', error)
        } else {
          console.log(`✅ Subscription ${subscription.id} updated`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        console.log('🗑️ Canceling subscription:', subscription.id)

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('❌ Error canceling subscription:', error)
        } else {
          console.log(`✅ Subscription ${subscription.id} canceled`)
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('💥 Webhook error:', error)
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
  console.log('🔄 Starting profile and subscription creation for user:', userId)
  
  // Buscar a subscription do Stripe
  const subscriptionId = session.subscription as string
  console.log('📋 Fetching Stripe subscription:', subscriptionId)
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0].price.id
  
  console.log('💰 Price ID:', priceId)
  
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
  console.log('📦 Detected plan:', plan)

  // 3️⃣ CRIAR/ATUALIZAR PROFILE
  console.log('👤 Creating/updating profile...')
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
    console.error('❌ Error creating profile:', profileError)
    console.error('Profile error details:', JSON.stringify(profileError))
  } else {
    console.log('✅ Profile created/updated')
  }

  // 4️⃣ CRIAR/ATUALIZAR BARBERSHOP
  console.log('💈 Creating/updating barbershop...')
  const { error: barbershopError } = await supabase
    .from('barbershops')
    .upsert({
      barber_id: userId,
      barbershop_name: barbershopName || 'Minha Barbearia',
    }, {
      onConflict: 'barber_id'
    })

  if (barbershopError) {
    console.error('❌ Error creating barbershop:', barbershopError)
    console.error('Barbershop error details:', JSON.stringify(barbershopError))
  } else {
    console.log('✅ Barbershop created/updated')
  }

  // 5️⃣ CRIAR/ATUALIZAR SUBSCRIPTION
  console.log('💳 Creating/updating subscription record...')
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
    console.error('❌ Error creating subscription:', subscriptionError)
    console.error('Subscription error details:', JSON.stringify(subscriptionError))
  } else {
    console.log('✅ Subscription record created/updated')
  }
  
  console.log(`🎉 User ${userId} fully set up with subscription ${subscriptionId}`)
  console.log('⚠️ User needs to confirm email before logging in')
}