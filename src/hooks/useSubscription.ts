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

      setSubscription(data);

      // Verificar se tem acesso
      const validStatuses = ['active', 'trialing'];
      setHasAccess(validStatuses.includes(data.status));

    } catch (error) {
      console.error("Error checking subscription:", error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (feature: string): boolean => {
    if (!subscription || !hasAccess) return false;

    const features: Record<string, string[]> = {
      starter: ['walk_in', 'finance'],
      pro: ['walk_in', 'finance', 'online_booking', 'reminders'],
      master: ['walk_in', 'finance', 'online_booking', 'reminders', 'team_management'],
    };

    return features[subscription.plan]?.includes(feature) || false;
  };

  return {
    subscription,
    loading,
    hasAccess,
    hasFeature,
    refetch: checkSubscription,
  };
};