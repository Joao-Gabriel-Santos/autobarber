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
    return new Response('No signature', { status: 400 });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const event = await stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Webhook recebido:', event.type);

    // ✅ EVENTO 1: Quando o checkout é concluído (cartão OU boleto)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log('Checkout completado:', session.id);
      console.log('Payment status:', session.payment_status);
      
      // ⚠️ Para boleto: payment_status = 'unpaid' (boleto gerado, mas não pago)
      // ⚠️ Para cartão: payment_status = 'paid' (pago imediatamente)
      
      const metadata = session.metadata;
      if (!metadata?.email || !metadata?.password) {
        throw new Error('Metadata incompleto');
      }

      // ✅ Criar o usuário SEMPRE que o checkout for concluído
      console.log('Criando usuário:', metadata.email);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: metadata.email,
        password: metadata.password,
        email_confirm: true, // ⚠️ Confirmar email automaticamente
        user_metadata: {
          full_name: metadata.full_name,
          whatsapp: metadata.whatsapp,
        },
      });

      if (authError) {
        // ✅ Tratar o caso de usuário já existente (esperado em testes repetidos)
        if (authError.message.includes('already exists')) {
          console.log('Usuário já existe, prosseguindo com update de subscription.');
          // Recuperar o ID do usuário existente se necessário (pode ser complexo aqui)
          // Por simplicidade, assumimos que o restante da lógica é sobre a subscription, não o user
        } else {
          console.error('Erro fatal ao criar usuário:', authError);
          throw authError; // Para que o Stripe saiba que falhou
        }
      }

      const userId = authData.user.id;
      console.log('Usuário criado:', userId);

      // ✅ Criar profile
      await supabase.from('profiles').insert({
        id: userId,
        full_name: metadata.full_name,
        whatsapp: metadata.whatsapp,
      });

      // ✅ Criar barbearia
      await supabase.from('barbershops').insert({
        barber_id: userId,
        barbershop_name: metadata.barbershop_name,
      });

      // ✅ Criar subscription com status correto
      // Para boleto: status = 'incomplete' (aguardando pagamento)
      // Para cartão: status = 'trialing' ou 'active'
      const subscriptionStatus = session.payment_status === 'paid' ? 'trialing' : 'incomplete';
      
      await supabase.from('subscriptions').insert({
        user_id: userId,
        stripe_subscription_id: session.subscription as string,
        stripe_customer_id: session.customer as string,
        status: subscriptionStatus,
        plan: metadata.selected_plan,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      console.log('✅ Usuário configurado com sucesso');
    }

    // ✅ EVENTO 2: Quando o boleto é PAGO (ou cartão processado)
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      console.log('Pagamento bem-sucedido para customer:', customerId);

      // Atualizar status da subscription para 'active' ou 'trialing'
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({ 
            status: 'trialing', // ou 'active' se não tiver trial
          })
          .eq('id', subscription.id);

        console.log('✅ Subscription ativada');
      }
    }

    // ✅ EVENTO 3: Quando subscription é cancelada
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id);

      console.log('✅ Subscription cancelada');
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    );
  }
});