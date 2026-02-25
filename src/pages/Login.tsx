import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log("🔐 Tentando fazer login...");
    console.log("📧 Email:", email);
    console.log("🔑 Senha length:", password.length);

    try {
      console.log("🔍 Verificando se usuário existe...");
      
      const { data: userData, error: userCheckError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', '(SELECT id FROM auth.users WHERE email = $1)')
        .single();

      console.log("📊 Resultado da verificação:", { userData, userCheckError });

      console.log("🔐 Tentando autenticar...");
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      console.log("📊 Resposta do login:", {
        success: !!data,
        error: error,
        session: data?.session ? "✅ Sessão criada" : "❌ Sem sessão",
        user: data?.user ? {
          id: data.user.id,
          email: data.user.email,
          confirmed: data.user.email_confirmed_at ? "✅" : "❌",
        } : null
      });

      if (error) {
        console.error("❌ Erro detalhado:", {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack,
        });

        let errorMessage = "Erro ao fazer login";
        let errorDescription = error.message;

        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Credenciais inválidas";
          errorDescription = "Email ou senha incorretos. Verifique e tente novamente.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Email não confirmado";
          errorDescription = "Verifique seu email e confirme sua conta antes de fazer login.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "Usuário não encontrado";
          errorDescription = "Esta conta não existe. Deseja criar uma nova conta?";
        }

        toast({
          title: errorMessage,
          description: errorDescription,
          variant: "destructive",
        });

        throw error;
      }

      if (!data.session) {
        console.error("❌ Login bem-sucedido mas sem sessão criada");
        toast({
          title: "Erro de autenticação",
          description: "Login bem-sucedido mas a sessão não foi criada. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Login bem-sucedido!");
      console.log("👤 Usuário:", data.user.email);
      console.log("🎫 Token:", data.session.access_token.substring(0, 20) + "...");

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta ao AutoBarber",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("💥 Erro no bloco catch:", error);
      
      if (!error.message?.includes("Invalid login") && !error.message?.includes("not confirmed")) {
        toast({
          title: "Erro ao fazer login",
          description: error.message || "Tente novamente mais tarde",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold mb-2">Bem-vindo de volta</h1>
          <p className="text-muted-foreground">Entre na sua conta para continuar</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-strong">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full shadow-gold" 
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Não tem uma conta? </span>
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary"
              onClick={() => navigate("/signup")}
            >
              Criar conta
            </Button>
          </div>
          <div className="mt-6 text-center text-sm">
            <Button
              variant="link" 
              className="p-0 h-auto text-primary"
              onClick={() => navigate("/forgot-password")}>
                Redefinir Senha
              </Button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
          >
            ← Voltar para home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;