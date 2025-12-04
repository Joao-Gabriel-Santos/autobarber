import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    barbershopName: "",
    barberName: "",
    whatsapp: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1️⃣ Criar usuário no Auth com metadata
      // O trigger handle_new_user() criará o profile E a barbearia automaticamente
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: formData.barberName,
            whatsapp: formData.whatsapp,
            barbershop_name: formData.barbershopName, // 👈 Adicionar nome da barbearia
          }
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Usuário não foi criado.");

      // 2️⃣ O trigger do banco de dados criou tudo automaticamente!
      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu e-mail para confirmar e acessar o sistema.",
      });

      navigate("/login");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
          <h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
          <p className="text-muted-foreground">Comece a automatizar sua barbearia hoje</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-strong">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barbershopName">Nome da Barbearia</Label>
              <Input
                id="barbershopName"
                placeholder="Barbearia XYZ"
                value={formData.barbershopName}
                onChange={(e) => updateFormData("barbershopName", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barberName">Seu Nome</Label>
              <Input
                id="barberName"
                placeholder="João Silva"
                value={formData.barberName}
                onChange={(e) => updateFormData("barberName", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="(11) 99999-9999"
                value={formData.whatsapp}
                onChange={(e) => updateFormData("whatsapp", e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
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
                value={formData.password}
                onChange={(e) => updateFormData("password", e.target.value)}
                required
                minLength={6}
                className="bg-background"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full shadow-gold" 
              disabled={loading}
            >
              {loading ? "Criando conta..." : "Criar conta grátis"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Já tem uma conta? </span>
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary"
              onClick={() => navigate("/login")}
            >
              Fazer login
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

export default Signup;