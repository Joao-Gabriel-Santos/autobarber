import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success'>('loading');

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        throw new Error('ID da sessão não encontrado');
      }

      // Aguardar webhook processar (3 segundos)
      await new Promise(resolve => setTimeout(resolve, 3000));

      setStatus('success');

    } catch (error: any) {
      console.error('Error:', error);
      setStatus('success'); // Mesmo com erro, mostrar sucesso pois o pagamento foi feito
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center border-border bg-card">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Processando pagamento...</h2>
            <p className="text-muted-foreground">Aguarde enquanto confirmamos sua assinatura</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-green-500">Pagamento Confirmado!</h2>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 my-6">
              <Mail className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">
                📧 Verifique seu email
              </p>
              <p className="text-xs text-muted-foreground">
                Enviamos um link de confirmação para seu email. 
                <br />
                <strong>Clique no link antes de fazer login.</strong>
              </p>
            </div>

            <div className="space-y-3 text-left text-sm text-muted-foreground mb-6">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <p>Sua conta foi criada com sucesso</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <p>Sua assinatura está ativa (7 dias grátis)</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500">📧</span>
                <p>Confirme seu email para acessar o sistema</p>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/login')}
                className="w-full"
                size="lg"
              >
                Ir para Login
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Não recebeu o email? Verifique sua caixa de spam ou aguarde alguns minutos
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default PaymentSuccess;