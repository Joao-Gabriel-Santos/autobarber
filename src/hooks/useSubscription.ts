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

export function useSubscription() {
  const [currentPlan, setCurrentPlan] = useState<PlanType>('starter');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('⚠️ Usuário não autenticado, usando starter');
        setCurrentPlan('starter');
        setLoading(false);
        return;
      }

      // Buscar subscription ativa do usuário
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao carregar assinatura:', error);
        setCurrentPlan('starter');
        setLoading(false);
        return;
      }

      // Se tiver subscription ativa, usa o plano dela
      if (subscription && subscription.plan) {
        // Converter o nome do plano para lowercase
        const planType = subscription.plan.toLowerCase() as PlanType;
        
        console.log('🔍 Plano encontrado:', planType);
        
        // Valida se o plano existe
        if (planType in PLAN_FEATURES) {
          setCurrentPlan(planType);
        } else {
          console.warn(`Plano desconhecido: ${planType}, usando 'starter'`);
          setCurrentPlan('starter');
        }
      } else {
        // Sem subscription = plano starter
        console.log('⚠️ Nenhuma subscription ativa encontrada, usando starter');
        setCurrentPlan('starter');
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Erro ao verificar assinatura:', error);
      setCurrentPlan('starter');
      setLoading(false);
    }
  };

  /**
   * Verifica se o plano atual tem acesso a uma feature específica
   */
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
  };
}