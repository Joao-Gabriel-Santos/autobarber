import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useManagePlan() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Não autenticado",
          description: "Faça login para gerenciar seu plano",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            return_url: `${window.location.origin}/dashboard`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao abrir portal");
      }

      // Redireciona para o Stripe Customer Portal
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Erro ao abrir gerenciamento de plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { openPortal, loading };
}