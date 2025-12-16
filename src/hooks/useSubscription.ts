// src/hooks/useSubscription.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Definição dos planos e suas features
const PLAN_FEATURES = {
  starter: {
    // ✅ O QUE TEM
    walk_in: true,              // Entrada direta
    services: true,             // Gerenciar serviços
    finance: true,              // Ver financeiro
    
    // ❌ O QUE NÃO TEM
    online_booking: false,      // Agendamento online
    schedule: false,            // Configurar horários
    reminders: false,           // Lembretes automáticos
    team_management: false,     // Gerenciar equipe
    custom_link: false,         // Link personalizado
  },
  
  pro: {
    // ✅ O QUE TEM
    walk_in: true,
    services: true,
    finance: true,
    online_booking: true,       // ✅ Agendamento online
    schedule: true,             // ✅ Configurar horários
    reminders: true,            // ✅ Lembretes automáticos
    custom_link: true,          // ✅ Link personalizado
    
    // ❌ O QUE NÃO TEM
    team_management: false,     // ❌ SEM gestão de equipe
  },
  
  master: {
    // ✅ TUDO LIBERADO
    walk_in: true,
    services: true,
    finance: true,
    online_booking: true,
    schedule: true,
    reminders: true,
    team_management: true,      // ✅ Gestão de equipe
    custom_link: true,
  },
} as const;

type PlanType = keyof typeof PLAN_FEATURES;
type FeatureType = keyof typeof PLAN_FEATURES.starter;

// 🚨 NOVO: Interface para o objeto de assinatura do Supabase
interface SubscriptionData {
  plan: string; // Vai ser 'starter', 'pro', 'master'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  current_period_end: string;
  cancel_at_period_end: boolean;
}

// 🚨 NOVO: Interface para o retorno completo do hook
interface UseSubscriptionReturn {
  currentPlan: PlanType;
  loading: boolean;
  hasFeature: (feature: FeatureType) => boolean;
  getPlanName: () => string;
  getFeatures: () => Record<FeatureType, boolean>;
  needsUpgrade: (feature: FeatureType) => boolean;
  getRequiredPlan: (feature: FeatureType) => PlanType | null;
  refresh: () => Promise<void>;
  
  // 🚨 PROPRIEDADES FALTANTES QUE O COMPONENTE PRECISA
  subscription: (SubscriptionData & { plan: PlanType }) | null; // Adicionado
  hasAccess: boolean; // Adicionado
}


export function useSubscription(): UseSubscriptionReturn { // 🚨 Adicionar o tipo de retorno
  const [currentPlan, setCurrentPlan] = useState<PlanType>('starter');
  const [loading, setLoading] = useState(true);
  
  // 🚨 NOVO ESTADO: Para armazenar o objeto de assinatura
  const [subscription, setSubscription] = useState<any>(null); // Usamos 'any' temporariamente ou definimos SubscriptionData completa
  
  // 🚨 NOVO ESTADO: Para verificar se tem acesso ativo
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

      // 🚨 MUDANÇA: Buscar mais campos da subscription para exibir na tela Settings
      const { data: subData, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end, cancel_at_period_end') // 🚨 Adicionado campos
        .eq('user_id', user.id)
        .order('current_period_end', { ascending: false }) // Buscar a mais recente
        .limit(1)
        .maybeSingle();

      if (error) {
        // ... (seu código de tratamento de erro)
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
        
        // Verifica se o status é considerado ativo (active ou trialing)
        if (['active', 'trialing'].includes(status)) {
          accessStatus = true;
        }

        const planType = subData.plan.toLowerCase() as PlanType;
        
        if (planType in PLAN_FEATURES) {
          finalPlan = planType;
        }
      }
      
      // 🚨 ATUALIZAÇÃO DOS NOVOS ESTADOS
      setSubscription(subData); // Armazena o objeto completo
      setHasAccess(accessStatus); // Armazena o status booleano
      setCurrentPlan(finalPlan);
      
      setLoading(false);
    } catch (error) {
      // ... (seu código de tratamento de erro)
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

  /**
   * Retorna o nome do plano atual formatado
   */
  const getPlanName = (): string => {
    const names: Record<PlanType, string> = {
      starter: 'Plano Starter',
      pro: 'Plano Pro',
      master: 'Plano Master',
    };
    return names[currentPlan] || 'Plano Starter';
  };

  /**
   * Retorna todas as features do plano atual
   */
  const getFeatures = () => {
    return PLAN_FEATURES[currentPlan];
  };

  /**
   * Verifica se o usuário precisa fazer upgrade para acessar uma feature
   */
  const needsUpgrade = (feature: FeatureType): boolean => {
    return !hasFeature(feature);
  };

  /**
   * Retorna o plano mínimo necessário para uma feature
   */
  const getRequiredPlan = (feature: FeatureType): PlanType | null => {
    // Verifica em ordem: starter -> pro -> master
    if (PLAN_FEATURES.starter[feature]) return 'starter';
    if (PLAN_FEATURES.pro[feature]) return 'pro';
    if (PLAN_FEATURES.master[feature]) return 'master';
    return null;
  };

 return {
    currentPlan,
    loading,
    hasFeature,
    getPlanName,
    getFeatures,
    needsUpgrade,
    getRequiredPlan,
    refresh: loadSubscription,
    subscription, 
    hasAccess,     
  };
}