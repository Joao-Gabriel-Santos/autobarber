import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PlanType = 'basic' | 'starter' | 'pro' | 'master';

interface OwnerSubscriptionData {
  ownerId: string;
  ownerPlan: PlanType;
  loading: boolean;
}

/**
 * Hook para barbeiros checarem o plano do owner da barbearia
 * INTEGRADO com o useSubscription existente
 */
export function useOwnerSubscription(userId: string): OwnerSubscriptionData {
  const [ownerId, setOwnerId] = useState<string>('');
  const [ownerPlan, setOwnerPlan] = useState<PlanType>('starter');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkOwnerPlan() {
      try {
        if (!userId) {
          setLoading(false);
          return;
        }

        console.log("🔍 useOwnerSubscription: Checking for user", userId);

        // 1. Buscar perfil do usuário
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, barbershop_id')
          .eq('id', userId)
          .single();

        if (profileError || !profile) {
          console.error("Error loading profile:", profileError);
          setLoading(false);
          return;
        }

        console.log("👤 Profile found:", profile);

        // 2. Determinar o owner ID
        let targetOwnerId = userId;
        
        if (profile.role === 'owner') {
          targetOwnerId = userId;
          console.log("👑 User is owner");
        } else if (profile.role === 'barber' && profile.barbershop_id) {
          targetOwnerId = profile.barbershop_id;
          console.log("💈 User is barber, owner is", profile.barbershop_id);
        }

        setOwnerId(targetOwnerId);

        // 3. Buscar subscription do owner usando a MESMA lógica do useSubscription
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, cancel_at_period_end')
          .eq('user_id', targetOwnerId)
          .order('current_period_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) {
          console.log("⚠️ Error fetching subscription:", subError.message);
          setOwnerPlan('starter');
        } else if (subData) {
          console.log("📊 Subscription data:", subData);
          
          // 4. Aplicar a MESMA lógica de validação do useSubscription
          const status = subData.status;
          const currentPeriodEnd = new Date(subData.current_period_end);
          const now = new Date();
          
          let hasAccess = false;
          
          if (status === 'active' || status === 'trialing') {
            hasAccess = true;
            console.log('✅ Assinatura válida:', status);
          } else if (status === 'past_due' && currentPeriodEnd > now) {
            hasAccess = true;
            console.log('⚠️ Assinatura com pagamento atrasado, mas dentro do período');
          } else {
            console.log('❌ Assinatura inválida:', status);
          }

          // 5. Determinar o plano
          if (hasAccess) {
            const planType = subData.plan.toLowerCase() as PlanType;
            
            if (['basic', 'starter', 'pro', 'master'].includes(planType)) {
              setOwnerPlan(planType);
              console.log("✅ Plan set to:", planType);
            } else {
              setOwnerPlan('starter');
              console.log("⚠️ Unknown plan, defaulting to starter");
            }
          } else {
            setOwnerPlan('starter');
            console.log("⚠️ No valid subscription, defaulting to starter");
          }
        } else {
          console.log("⚠️ No subscription found, defaulting to starter");
          setOwnerPlan('starter');
        }

      } catch (error) {
        console.error('Error in useOwnerSubscription:', error);
        setOwnerPlan('starter');
      } finally {
        setLoading(false);
      }
    }

    checkOwnerPlan();
  }, [userId]);

  return { ownerId, ownerPlan, loading };
}