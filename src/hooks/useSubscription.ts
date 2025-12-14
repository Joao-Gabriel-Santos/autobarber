// src/hooks/useSubscription.ts

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Subscription {
  id: string;
  plan: 'starter' | 'pro' | 'master';
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  current_period_end: string;
  cancel_at_period_end: boolean;
}

// 🎯 DEFINIÇÃO DE FEATURES POR PLANO
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
};

export const useSubscription = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Subscription check error:", error);
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const completeSubscription = {
        ...data,
        cancel_at_period_end: false, 
      } as Subscription;

      // ✅ Verificar se tem acesso
      const validStatuses = ['active', 'trialing'];
      setHasAccess(validStatuses.includes(data.status));

    } catch (error) {
      console.error("Error checking subscription:", error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  // 🔒 VERIFICAR SE TEM ACESSO A UMA FEATURE
  const hasFeature = (feature: keyof typeof PLAN_FEATURES.starter): boolean => {
    if (!subscription || !hasAccess) return false;
    return PLAN_FEATURES[subscription.plan]?.[feature] || false;
  };

  // 📊 OBTER NOME LEGÍVEL DO PLANO
  const getPlanName = (): string => {
    if (!subscription) return 'Sem plano';
    
    const names = {
      starter: 'Starter',
      pro: 'Pro',
      master: 'Master',
    };
    
    return names[subscription.plan] || subscription.plan;
  };

  // 💰 OBTER PREÇO DO PLANO
  const getPlanPrice = (): number => {
    if (!subscription) return 0;
    
    const prices = {
      starter: 27,
      pro: 57,
      master: 97,
    };
    
    return prices[subscription.plan] || 0;
  };

  // 📋 LISTAR TODAS AS FEATURES DO PLANO ATUAL
  const getPlanFeatures = () => {
    if (!subscription) return [];
    return PLAN_FEATURES[subscription.plan];
  };

  // 🚀 SUGERIR UPGRADE
  const suggestUpgrade = (feature: keyof typeof PLAN_FEATURES.starter): string | null => {
    if (!subscription) return null;
    
    // Se já tem a feature, não precisa upgrade
    if (hasFeature(feature)) return null;
    
    // Verificar qual plano tem essa feature
    if (PLAN_FEATURES.pro[feature] && subscription.plan === 'starter') {
      return 'Disponível no plano Pro';
    }
    
    if (PLAN_FEATURES.master[feature]) {
      return subscription.plan === 'starter' 
        ? 'Disponível nos planos Pro e Master'
        : 'Disponível no plano Master';
    }
    
    return null;
  };

  return {
    subscription,
    loading,
    hasAccess,
    hasFeature,
    getPlanName,
    getPlanPrice,
    getPlanFeatures,
    suggestUpgrade,
    refetch: checkSubscription,
  };
};