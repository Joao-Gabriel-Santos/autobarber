// src/hooks/useSubscription.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Definição dos planos e suas features
const PLAN_FEATURES = {
  starter: {
    walk_in: true,
    services: true,
    finance: true,
    online_booking: false,
    schedule: false,
    reminders: false,
    team_management: false,
    custom_link: false,
  },
  
  pro: {
    walk_in: true,
    services: true,
    finance: true,
    online_booking: true,
    schedule: true,
    reminders: true,
    custom_link: true,
    team_management: false,
  },
  
  master: {
    walk_in: true,
    services: true,
    finance: true,
    online_booking: true,
    schedule: true,
    reminders: true,
    team_management: true,
    custom_link: true,
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

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('⚠️ Usuário não autenticado, usando starter');
        setSubscription(null);
        setHasAccess(false);
        setCurrentPlan('starter');
        setLoading(false);
        return;
      }

      // 🔍 Verificar se é barbeiro (funcionário) ou owner
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, barbershop_id')
        .eq('id', user.id)
        .single();

      let ownerId = user.id;
      
      // Se for barbeiro, buscar assinatura do owner
      if (profile?.role === 'barber' && profile.barbershop_id) {
        ownerId = profile.barbershop_id;
        console.log('👤 Barbeiro detectado, buscando plano do owner:', ownerId);
      }

      // Buscar assinatura do owner
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
        
        if (['active', 'trialing'].includes(status) && currentPeriodEnd > now) {
          accessStatus = true;
        }

        const planType = subData.plan.toLowerCase() as PlanType;
        
        if (planType in PLAN_FEATURES) {
          finalPlan = planType;
        }
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
  };

  const hasFeature = (feature: FeatureType): boolean => {
    const features = PLAN_FEATURES[currentPlan];
    return features[feature] === true;
  };

  const getPlanName = (): string => {
    const names: Record<PlanType, string> = {
      starter: 'Plano Starter',
      pro: 'Plano Pro',
      master: 'Plano Master',
    };
    return names[currentPlan] || 'Plano Starter';
  };

  const getFeatures = () => {
    return PLAN_FEATURES[currentPlan];
  };

  const needsUpgrade = (feature: FeatureType): boolean => {
    return !hasFeature(feature);
  };

  const getRequiredPlan = (feature: FeatureType): PlanType | null => {
    if (PLAN_FEATURES.starter[feature]) return 'starter';
    if (PLAN_FEATURES.pro[feature]) return 'pro';
    if (PLAN_FEATURES.master[feature]) return 'master';
    return null;
  };

  /**
   * Retorna uma mensagem sugerindo upgrade para acessar uma feature
   */
  const suggestUpgrade = (feature: FeatureType): string | null => {
    if (hasFeature(feature)) {
      return null; // Já tem acesso
    }

    const requiredPlan = getRequiredPlan(feature);
    
    if (!requiredPlan) {
      return null;
    }

    const planNames: Record<PlanType, string> = {
      starter: 'Starter',
      pro: 'Pro',
      master: 'Master',
    };

    // Se está no Starter e precisa de Pro
    if (currentPlan === 'starter' && requiredPlan === 'pro') {
      return `Faça upgrade para o Plano Pro para desbloquear esta funcionalidade.`;
    }

    // Se está no Starter e precisa de Master
    if (currentPlan === 'starter' && requiredPlan === 'master') {
      return `Faça upgrade para o Plano Master para desbloquear esta funcionalidade.`;
    }

    // Se está no Pro e precisa de Master
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