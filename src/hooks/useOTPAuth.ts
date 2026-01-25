// src/hooks/useOTPAuth.ts
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppService } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";

interface OTPAuthState {
  step: "phone" | "code" | "authenticated";
  loading: boolean;
  phone: string;
  code: string;
  sessionId: string | null;
}

export const useOTPAuth = () => {
  const { toast } = useToast();
  const [state, setState] = useState<OTPAuthState>({
    step: "phone",
    loading: false,
    phone: "",
    code: "",
    sessionId: null,
  });

  /**
   * Envia código OTP via WhatsApp
   */
  const sendOTP = async (phoneNumber: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      // Gerar código de 6 dígitos
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Salvar código em sessão temporária (pode ser no localStorage ou Supabase)
      const sessionId = crypto.randomUUID();
      localStorage.setItem(`otp_${sessionId}`, JSON.stringify({
        phone: phoneNumber,
        code,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
      }));

      // Enviar via WhatsApp
      const sent = await WhatsAppService.sendOTP(phoneNumber, code);

      if (sent) {
        setState(prev => ({
          ...prev,
          step: "code",
          phone: phoneNumber,
          sessionId,
          loading: false,
        }));

        toast({
          title: "Código enviado!",
          description: `Enviamos um código para ${phoneNumber}`,
        });

        return true;
      }

      throw new Error("Falha ao enviar código");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar código",
        description: error.message,
        variant: "destructive",
      });

      setState(prev => ({ ...prev, loading: false }));
      return false;
    }
  };

  /**
   * Verifica código OTP
   */
  const verifyOTP = async (code: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const { sessionId, phone } = state;
      if (!sessionId || !phone) {
        throw new Error("Sessão inválida");
      }

      // Recuperar código salvo
      const savedData = localStorage.getItem(`otp_${sessionId}`);
      if (!savedData) {
        throw new Error("Código expirado");
      }

      const { code: savedCode, expiresAt } = JSON.parse(savedData);

      // Verificar expiração
      if (Date.now() > expiresAt) {
        localStorage.removeItem(`otp_${sessionId}`);
        throw new Error("Código expirado");
      }

      // Verificar código
      if (code !== savedCode) {
        throw new Error("Código incorreto");
      }

      // Limpar sessão
      localStorage.removeItem(`otp_${sessionId}`);

      setState(prev => ({
        ...prev,
        step: "authenticated",
        code,
        loading: false,
      }));

      toast({
        title: "Verificado com sucesso!",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive",
      });

      setState(prev => ({ ...prev, loading: false }));
      return false;
    }
  };

  /**
   * Reset do fluxo
   */
  const reset = () => {
    setState({
      step: "phone",
      loading: false,
      phone: "",
      code: "",
      sessionId: null,
    });
  };

  return {
    ...state,
    sendOTP,
    verifyOTP,
    reset,
  };
};

// ============================================
// COMPONENTE DE AUTENTICAÇÃO OTP
// ============================================
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, ShieldCheck } from "lucide-react";

interface OTPAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (phone: string) => void;
}

export const OTPAuthDialog = ({ open, onOpenChange, onAuthenticated }: OTPAuthDialogProps) => {
  const { step, loading, phone, sendOTP, verifyOTP, reset } = useOTPAuth();
  const [phoneInput, setPhoneInput] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const handleSendCode = async () => {
    const success = await sendOTP(phoneInput);
    if (!success) {
      setPhoneInput("");
    }
  };

  const handleVerifyCode = async () => {
    const success = await verifyOTP(codeInput);
    if (success) {
      onAuthenticated(phone);
      onOpenChange(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verificação por WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === "phone" && (
            <>
              <div>
                <Label htmlFor="phone">WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enviaremos um código de verificação
                </p>
              </div>

              <Button
                onClick={handleSendCode}
                disabled={loading || !phoneInput}
                className="w-full"
              >
                {loading ? "Enviando..." : "Enviar Código"}
              </Button>
            </>
          )}

          {step === "code" && (
            <>
              <div>
                <Label htmlFor="code">Código de Verificação</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                  disabled={loading}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o código enviado para {phone}
                </p>
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={loading || codeInput.length !== 6}
                className="w-full"
              >
                {loading ? "Verificando..." : "Verificar"}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  setPhoneInput("");
                  setCodeInput("");
                }}
                className="w-full"
              >
                Usar outro número
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};