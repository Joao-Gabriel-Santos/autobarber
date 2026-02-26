import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PLAN_FEATURES = {
  basic: {
    walk_in: true,
    services: true,
    finance: true,
    statistics: false,
    online_booking: false,
    schedule: false,
    reminders: false,
    team_management: false,
    custom_link: false,
    stock: false,
    product: false
  },
  starter: {
    walk_in: true,
    services: true,
    finance: true,
    statistics: true,
    online_booking: false,
    schedule: false,
    reminders: false,
    team_management: true,
    custom_link: false,
    stock: false,
    product: false
  },
  pro: {
    walk_in: true,
    services: true,
    finance: true,
    statistics: true,
    online_booking: true,
    schedule: true,
    reminders: true,
    custom_link: true,
    team_management: false,
    stock: false,
    product: false
  },
  master: {
    walk_in: true,
    services: true,
    finance: true,
    statistics: true,
    online_booking: true,
    schedule: true,
    reminders: true,
    team_management: true,
    custom_link: true,
    stock: true,
    product: true
  },
} as const;

type PlanType = keyof typeof PLAN_FEATURES;
type FeatureType = keyof typeof PLAN_FEATURES.starter;

interface SubscriptionData {
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface UseSubscriptionReturn {
  currentPlan: PlanType;
  loading: boolean;
  hasFeature: (feature: FeatureType) => boolean;
  getPlanName: () => string;
  getFeatures: () => Record<FeatureType, boolean>;
  needsUpgrade: (feature: FeatureType) => boolean;
  getRequiredPlan: (feature: FeatureType) => PlanType | null;
  suggestUpgrade: (feature: FeatureType) => string | null;
  refresh: () => Promise<void>;
  subscription: (SubscriptionData & { plan: PlanType }) | null;
  hasAccess: boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const [currentPlan, setCurrentPlan] = useState<PlanType>('starter');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setSubscription(null);
        setHasAccess(false);
        setCurrentPlan('starter');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, barbershop_id')
        .eq('id', user.id)
        .single();

      let ownerId = user.id;
      
      if (profile?.role === 'barber' && profile.barbershop_id) {
        ownerId = profile.barbershop_id;
      }

      // ✅ CORREÇÃO: força busca sem cache usando timestamp no header
      const { data: subData, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end, cancel_at_period_end')
        .eq('user_id', ownerId)
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading subscription:', error);
        setSubscription(null);
        setHasAccess(false);
        setCurrentPlan('starter');
        setLoading(false);
        return;
      }
      
      let finalPlan: PlanType = 'starter';
      let accessStatus = false;
      
      if (subData) {
        const status = subData.status;
        const currentPeriodEnd = new Date(subData.current_period_end);
        const now = new Date();
        
        if (status === 'active' || status === 'trialing') {
          accessStatus = true;
        } else if (status === 'past_due' && currentPeriodEnd > now) {
          accessStatus = true;
        }

        // ✅ CORREÇÃO: sempre aplica o plano do banco, independente do accessStatus
        const planType = subData.plan.toLowerCase() as PlanType;
        
        if (planType in PLAN_FEATURES) {
          finalPlan = planType;
        }

        console.log(`📋 Subscription loaded — plan: ${planType}, status: ${status}, hasAccess: ${accessStatus}`);
      }
      
      setSubscription(subData);
      setHasAccess(accessStatus);
      setCurrentPlan(finalPlan);
      setLoading(false);
    } catch (error) {
      console.error('Error in loadSubscription:', error);
      setSubscription(null);
      setHasAccess(false);
      setCurrentPlan('starter');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();

    // ✅ Recarrega quando o usuário volta para a aba (retorno do portal Stripe)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Aba visível novamente — recarregando subscription...');
        loadSubscription();
      }
    };

    // ✅ Fallback: recarrega quando a janela recupera foco
    const handleFocus = () => {
      console.log('🔍 Janela em foco — recarregando subscription...');
      loadSubscription();
    };

    // ✅ NOVO: detecta retorno do portal Stripe via URL param ?refresh=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('refresh') === 'true') {
      console.log('🔄 Retorno do portal Stripe detectado — forçando refresh...');
      loadSubscription().then(() => {
        // Limpa o param da URL sem reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadSubscription]);

  const hasFeature = (feature: FeatureType): boolean => {
    return PLAN_FEATURES[currentPlan][feature] === true;
  };

  const getPlanName = (): string => {
    const names: Record<PlanType, string> = {
      basic: 'Plano Basic',
      starter: 'Plano Starter',
      pro: 'Plano Pro',
      master: 'Plano Master',
    };
    return names[currentPlan] || 'Plano Starter';
  };

  const getFeatures = () => PLAN_FEATURES[currentPlan];

  const needsUpgrade = (feature: FeatureType): boolean => !hasFeature(feature);

  const getRequiredPlan = (feature: FeatureType): PlanType | null => {
    if (PLAN_FEATURES.starter[feature]) return 'starter';
    if (PLAN_FEATURES.pro[feature]) return 'pro';
    if (PLAN_FEATURES.master[feature]) return 'master';
    return null;
  };

  const suggestUpgrade = (feature: FeatureType): string | null => {
    if (hasFeature(feature)) return null;

    const requiredPlan = getRequiredPlan(feature);
    if (!requiredPlan) return null;

    const planNames: Record<PlanType, string> = {
      basic: 'Basic',
      starter: 'Starter',
      pro: 'Pro',
      master: 'Master',
    };

    if (currentPlan === 'starter' && requiredPlan === 'pro') {
      return `Faça upgrade para o Plano Pro para desbloquear esta funcionalidade.`;
    }
    if (currentPlan === 'starter' && requiredPlan === 'master') {
      return `Faça upgrade para o Plano Master para desbloquear esta funcionalidade.`;
    }
    if (currentPlan === 'pro' && requiredPlan === 'master') {
      return `Faça upgrade para o Plano Master para desbloquear esta funcionalidade.`;
    }

    return `Faça upgrade para o Plano ${planNames[requiredPlan]} para acessar esta funcionalidade.`;
  };

  return {
    currentPlan,
    loading,
    hasFeature,
    getPlanName,
    getFeatures,
    needsUpgrade,
    getRequiredPlan,
    suggestUpgrade,
    refresh: loadSubscription,
    subscription,
    hasAccess,
  };
}