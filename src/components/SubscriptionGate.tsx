import { ReactNode, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionGateProps {
  children: ReactNode;
  allowedRoutes?: string[]; // Rotas que podem ser acessadas mesmo sem assinatura ativa
}

export const SubscriptionGate = ({ children, allowedRoutes = ['/settings'] }: SubscriptionGateProps) => {
  const { hasAccess, subscription, loading } = useSubscription();
  
  // Verificar se a rota atual é permitida
  const currentPath = window.location.pathname;
  const isAllowedRoute = allowedRoutes.some(route => currentPath.startsWith(route));

  useEffect(() => {
    // Se não tem acesso e não está em rota permitida, mostrar bloqueio
    if (!loading && !hasAccess && !isAllowedRoute) {
      console.log('🚫 Acesso bloqueado - Assinatura inativa');
    }
  }, [hasAccess, loading, isAllowedRoute]);

  // Mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-gradient-gold animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  // Se tem acesso ou está em rota permitida, renderizar normalmente
  if (hasAccess || isAllowedRoute) {
    return <>{children}</>;
  }

  // Bloquear acesso - Assinatura expirada/cancelada
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center border-border bg-card">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
        
        <h2 className="text-2xl font-bold mb-2">
          Assinatura Vencida
        </h2>
        
        <p className="text-muted-foreground mb-4">
          Sua assinatura do AutoBarber expirou ou está com pagamento pendente.
        </p>

        {subscription && (
          <Alert variant="destructive" className="mb-6">
            <CreditCard className="h-4 w-4" />
            <AlertDescription>
              <strong>Status:</strong> {
                subscription.status === 'past_due' ? 'Pagamento Atrasado' :
                subscription.status === 'canceled' ? 'Cancelado' :
                'Inativo'
              }
              <br />
              <strong>Plano:</strong> {subscription.plan}
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            💡 Renove sua assinatura para continuar usando todas as funcionalidades do AutoBarber
          </p>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={() => {
              window.open('https://billing.stripe.com/p/login/3cI6oG25w02o2J0fN0a3u00', '_blank');
            }}
            className="w-full shadow-gold"
            size="lg"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Renovar Assinatura
          </Button>
          
          <Button 
            onClick={() => window.location.href = "/settings"}
            variant="outline"
            className="w-full"
          >
            Ir para Configurações
          </Button>

          <Button 
            onClick={() => {
              supabase.auth.signOut().then(() => {
                window.location.href = "/";
              });
            }}
            variant="ghost"
            className="w-full"
          >
            Sair
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Problemas com o pagamento? Entre em contato com o suporte
        </p>
      </Card>
    </div>
  );
};

// Hook para verificar acesso (opcional, para uso em lógica)
export const useSubscriptionAccess = () => {
  const { hasAccess, loading } = useSubscription();
  return { hasAccess, loading };
};