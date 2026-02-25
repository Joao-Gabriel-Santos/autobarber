import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle, Mail } from "lucide-react";

const ConfirmEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    handleEmailConfirmation();
  }, []);

  const handleEmailConfirmation = async () => {
    try {
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      
      console.log('Token recebido:', token);
      console.log('Type:', type);

      if (!token) {
        setStatus('error');
        setMessage('Link de confirmação inválido ou expirado.');
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type === 'signup' ? 'signup' : 'email',
      });

      console.log('Resultado da verificação:', { data, error });

      if (error) {
        console.error('Erro na verificação:', error);
        setStatus('error');
        setMessage(error.message || 'Erro ao confirmar email. Tente fazer login.');
        return;
      }

      if (data.user) {
        setStatus('success');
        setMessage('Email confirmado com sucesso!');
        
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('Não foi possível confirmar o email.');
      }

    } catch (error: any) {
      console.error('Erro geral:', error);
      setStatus('error');
      setMessage(error.message || 'Erro inesperado. Tente fazer login.');
    }
  };

  const resendEmail = async () => {
    try {
      const email = prompt('Digite seu email para reenviar a confirmação:');
      if (!email) return;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      alert('Email de confirmação reenviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      alert('Erro ao reenviar: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center border-border bg-card">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Confirmando email...</h2>
            <p className="text-muted-foreground">Aguarde um momento</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-green-500">Email Confirmado!</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Ir para Login
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-red-500">Erro na Confirmação</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            
            <div className="space-y-3">
              <Button onClick={() => navigate('/login')} className="w-full">
                Tentar Fazer Login
              </Button>
              
              <Button 
                onClick={resendEmail} 
                variant="outline"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Reenviar Email
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Se o problema persistir, entre em contato com o suporte
            </p>
          </>
        )}
      </Card>
    </div>
  );
};

export default ConfirmEmail;