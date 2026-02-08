// src/components/OTPAuthDialog.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { useOTPAuth } from "@/hooks/useOTPAuth";

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