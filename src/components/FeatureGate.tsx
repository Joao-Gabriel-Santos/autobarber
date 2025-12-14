// src/components/FeatureGate.tsx

import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
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
  const { hasFeature, suggestUpgrade, getPlanName } = useSubscription();
  const navigate = useNavigate();

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