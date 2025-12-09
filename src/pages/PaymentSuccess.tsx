import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando seu pagamento...');

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        throw new Error('ID da sessão não encontrado');
      }

      setMessage('Verificando pagamento...');

      // Aguardar alguns segundos para o webhook processar
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Tentar obter o usuário atual (webhook já deve ter criado)
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        // Se não estiver logado, tentar login silencioso (caso o webhook tenha criado)
        setMessage('Verificando sua conta...');
        
        // Esperar mais um pouco
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar novamente
        const { data: { user: retryUser } } = await supabase.auth.getUser();
        
        if (!retryUser) {
          throw new Error('Sua conta está sendo criada. Por favor, aguarde alguns segundos e faça login.');
        }
      }

      setStatus('success');
      setMessage('Pagamento confirmado! Redirecionando...');

      // Redirecionar para o dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('Error verifying payment:', error);
      setStatus('error');
      setMessage(error.message || 'Erro ao verificar pagamento. Tente fazer login.');
      
      setTimeout(() => {
        navigate('/login');
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center border-border bg-card">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Processando...</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-green-500">Pagamento Confirmado!</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-red-500">Atenção</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecionando para login em 5 segundos...
            </p>
          </>
        )}
      </Card>
    </div>
  );
};

export default PaymentSuccess;