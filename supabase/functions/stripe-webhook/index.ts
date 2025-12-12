import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@15'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    console.error('❌ Webhook sem assinatura');
    return new Response('No signature', { status: 400 });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const event = await stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('✅ Webhook recebido:', event.type);

    // ✅ EVENTO 1: Quando o checkout é concluído (cartão OU boleto)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log('📋 Checkout completado:', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        customerId: session.customer,
        subscriptionId: session.subscription
      });
      
      const metadata = session.metadata;
      
      console.log('📦 Metadata recebido:', {
        email: metadata?.email,
        hasPassword: !!metadata?.password,
        fullName: metadata?.full_name,
        whatsapp: metadata?.whatsapp,
        barbershopName: metadata?.barbershop_name,
        plan: metadata?.selected_plan
      });

      if (!metadata?.email || !metadata?.password) {
        console.error('❌ Metadata incompleto:', metadata);
        throw new Error('Metadata incompleto - email ou senha ausente');
      }

      // ✅ Verificar se usuário já existe
      console.log('🔍 Verificando se usuário já existe...');
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === metadata.email);

      let userId: string;

      if (existingUser) {
        console.log('⚠️ Usuário já existe:', existingUser.id);
        userId = existingUser.id;
      } else {
        // ✅ Criar o usuário
        console.log('👤 Criando novo usuário:', metadata.email);
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: metadata.email,
          password: metadata.password,
          email_confirm: true,
          user_metadata: {
            full_name: metadata.full_name,
            whatsapp: metadata.whatsapp,
          },
        });

        if (authError) {
          console.error('❌ Erro ao criar usuário:', authError);
          throw authError;
        }

        if (!authData?.user) {
          console.error('❌ Usuário não foi retornado após criação');
          throw new Error('Usuário não criado');
        }

        userId = authData.user.id;
        console.log('✅ Usuário criado:', userId);

        // ✅ Criar profile
        console.log('📝 Criando profile...');
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          full_name: metadata.full_name,
          whatsapp: metadata.whatsapp,
        });

        if (profileError) {
          console.error('❌ Erro ao criar profile:', profileError);
        } else {
          console.log('✅ Profile criado');
        }

        // ✅ Criar barbearia
        console.log('💈 Criando barbearia...');
        const { error: barbershopError } = await supabase.from('barbershops').insert({
          barber_id: userId,
          barbershop_name: metadata.barbershop_name,
        });

        if (barbershopError) {
          console.error('❌ Erro ao criar barbearia:', barbershopError);
        } else {
          console.log('✅ Barbearia criada');
        }
      }

      // ✅ Verificar se subscription já existe
      console.log('🔍 Verificando subscription existente...');
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSubscription) {
        console.log('⚠️ Subscription já existe, atualizando...');
        
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: session.payment_status === 'paid' ? 'trialing' : 'incomplete',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', existingSubscription.id);

        if (updateError) {
          console.error('❌ Erro ao atualizar subscription:', updateError);
        } else {
          console.log('✅ Subscription atualizada');
        }
      } else {
        console.log('📝 Criando subscription...');
        
        const subscriptionStatus = session.payment_status === 'paid' ? 'trialing' : 'incomplete';
        
        const { error: subscriptionError } = await supabase.from('subscriptions').insert({
          user_id: userId,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
          status: subscriptionStatus,
          plan: metadata.selected_plan,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (subscriptionError) {
          console.error('❌ Erro ao criar subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('✅ Subscription criada com status:', subscriptionStatus);
      }

      console.log('🎉 Usuário configurado com sucesso!');
    }

    // ✅ EVENTO 2: Quando o boleto é PAGO (ou cartão processado)
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      console.log('💰 Pagamento bem-sucedido para customer:', customerId);

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (subscription) {
        console.log('✅ Ativando subscription...');
        await supabase
          .from('subscriptions')
          .update({ 
            status: 'trialing',
          })
          .eq('id', subscription.id);

        console.log('✅ Subscription ativada');
      } else {
        console.log('⚠️ Subscription não encontrada para customer:', customerId);
      }
    }

    // ✅ EVENTO 3: Quando subscription é cancelada
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      
      console.log('❌ Cancelando subscription:', subscription.id);
      
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id);

      console.log('✅ Subscription cancelada');
    }

    console.log('✅ Webhook processado com sucesso');
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro no webhook:', {
      message: error.message,
      stack: error.stack,
      details: error
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});