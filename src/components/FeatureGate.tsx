// src/components/FeatureGate.tsx

import { ReactNode } from "react";
import React from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Zap, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  feature: 'walk_in' | 'services' | 'finance' | 'online_booking' | 'schedule' | 'reminders' | 'team_management' | 'custom_link';
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureGate = ({ feature, children, fallback }: FeatureGateProps) => {
  const { hasFeature, suggestUpgrade, getPlanName, loading } = useSubscription();
  const navigate = useNavigate();
  const [userRole, setUserRole] = React.useState<'owner' | 'barber' | null>(null);

  React.useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserRole(profile.role as 'owner' | 'barber');
      }
    } catch (error) {
      console.error('Error checking role:', error);
    }
  };

  // Mostrar loading enquanto carrega
  if (loading || userRole === null) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-gradient-gold animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // ✅ Se tem acesso, renderiza o conteúdo
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // ❌ Se não tem acesso, mostra o fallback ou mensagem de upgrade
  if (fallback) {
    return <>{fallback}</>;
  }

  const upgradeMessage = suggestUpgrade(feature);

  const featureNames: Record<string, string> = {
    walk_in: 'Entrada Direta',
    services: 'Gerenciar Serviços',
    finance: 'Painel Financeiro',
    online_booking: 'Agendamento Online',
    schedule: 'Configurar Horários',
    reminders: 'Lembretes Automáticos',
    team_management: 'Gestão de Equipe',
    custom_link: 'Link Personalizado',
  };

  const getUpgradeIcon = () => {
    if (upgradeMessage?.includes('Master')) {
      return <Crown className="h-12 w-12 text-primary mb-4 mx-auto" />;
    }
    if (upgradeMessage?.includes('Pro')) {
      return <Zap className="h-12 w-12 text-primary mb-4 mx-auto" />;
    }
    return <Lock className="h-12 w-12 text-primary mb-4 mx-auto" />;
  };

  // 🚫 BARBEIROS: Mostrar mensagem especial (sem botão de upgrade)
  if (userRole === 'barber') {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center border-border bg-card">
          <Lock className="h-12 w-12 text-primary mb-4 mx-auto" />
          
          <h2 className="text-2xl font-bold mb-2">
            {featureNames[feature]} 
          </h2>
          
          <p className="text-muted-foreground mb-4">
            Esta funcionalidade não está disponível no plano atual da barbearia.
          </p>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              💡 Entre em contato com o dono da barbearia para solicitar o upgrade do plano.
            </p>
          </div>
          
          <Button 
            onClick={() => navigate("/dashboard")}
            variant="outline"
            className="w-full"
          >
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // 👔 OWNERS: Mostrar opções de upgrade
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center border-border bg-card">
        {getUpgradeIcon()}
        
        <h2 className="text-2xl font-bold mb-2">
          {featureNames[feature]} 
        </h2>
        
        <p className="text-muted-foreground mb-4">
          Esta funcionalidade não está disponível no seu plano atual: <strong>{getPlanName()}</strong>
        </p>
        
        {upgradeMessage && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-primary font-medium">
              ✨ {upgradeMessage}
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          <Button 
            onClick={() => navigate("/signup")}
            className="w-full shadow-gold"
            size="lg"
          >
            Fazer Upgrade
          </Button>
          
          <Button 
            onClick={() => navigate("/dashboard")}
            variant="outline"
            className="w-full"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

// 🔒 Hook simples para usar em componentes
export const useFeatureAccess = (feature: FeatureGateProps['feature']) => {
  const { hasFeature } = useSubscription();
  return hasFeature(feature);
};