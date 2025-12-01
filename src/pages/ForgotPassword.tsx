import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);


  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setMessage("Erro: " + error.message);
    } else {
      setMessage("Enviamos um link de redefinição para seu e-mail.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-gold flex items-center justify-center font-bold text-primary-foreground">
              AB
            </div>
            <span className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              AutoBarber
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Redefinir Senha</h1>
          <p className="text-muted-foreground">Verifique seu email e faça a mudança da senha</p>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-8 shadow-strong">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        type="email"
                        placeholder="Digite seu e-mail"
                        className="bg-background"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                  </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full shadow-gold"
                    >
                        {loading ? "Enviando..." : "Enviar link"}
                    </Button>
                

          {message && (
            <p className="text-center text-sm mt-2">{message}</p>
          )}
        </form>
        </div>
        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/login")}
          >
            ← Voltar ao login
          </Button>
        </div>
      </div>
    </div>
  );
}
