import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Settings as SettingsIcon, User, Image as ImageIcon, LinkIcon, Info, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions } = usePermissions();
  const [user, setUser] = useState<any>(null);
  const [barbershopId, setBarbershopId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    barbershopName: "",
    fullName: "",
    whatsapp: "",
    avatarUrl: "",
    bannerUrl: "",
    slug: "",
    antiFaltasEnabled: true,
    remindersEnabled: true,
    ownerAcceptsAppointments: true, // Nova opção
  });
  const { subscription, hasAccess } = useSubscription();

  const isOwner = permissions?.role === 'owner';

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }
      
      setUser(user);
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      // Buscar dados da barbearia (se for owner) ou do owner (se for barbeiro)
      let barbershopData = null;
      let targetId = user.id;
      
      if (profile?.role === 'barber' && profile.barbershop_id) {
        // Se for barbeiro, buscar dados do owner
        targetId = profile.barbershop_id;
      }
      
      const { data: barbershop, error: barbershopError } = await supabase
        .from("barbershops")
        .select("*")
        .eq("barber_id", targetId)
        .single();
      
      if (barbershopError) {
        console.error("Error loading barbershop:", barbershopError);
      }
      
      if (barbershop) {
        setBarbershopId(barbershop.barber_id);
        
        const timestamp = new Date().getTime();
        
        // Para barbeiros, buscar sua própria foto
        const photoUserId = profile?.role === 'barber' ? user.id : barbershop.barber_id;
        
        const { data: { publicUrl: avatarUrl } } = supabase
          .storage
          .from('avatars')
          .getPublicUrl(`${photoUserId}/avatar.png`);
        
        const { data: { publicUrl: bannerUrl } } = supabase
          .storage
          .from('banners')
          .getPublicUrl(`${barbershop.barber_id}/banner.png`);
        
        setFormData({
          barbershopName: barbershop.barbershop_name || "",
          fullName: profile?.full_name || "",
          whatsapp: profile?.whatsapp || "",
          avatarUrl: `${avatarUrl}?t=${timestamp}`,
          bannerUrl: `${bannerUrl}?t=${timestamp}`,
          slug: barbershop.slug || "",
          antiFaltasEnabled: true,
          remindersEnabled: true,
          ownerAcceptsAppointments: barbershop.owner_accepts_appointments ?? true,
        });
      }
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'barbershop-logo' | 'banner'
  ) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    setUploading(type);

    try {
      let bucketName: string;
      let fileName: string;
      let fieldName: string;
      
      if (type === 'avatar') {
        bucketName = 'avatars';
        fileName = `${user.id}/avatar.png`;
        fieldName = 'avatarUrl';
      } else if (type === 'barbershop-logo') {
        bucketName = 'barbershop-logos';
        fileName = `${barbershopId}/logo.png`;
        fieldName = 'barbershopAvatarUrl';
      } else {
        bucketName = 'banners';
        fileName = `${barbershopId}/banner.png`;
        fieldName = 'bannerUrl';
      }

      await supabase.storage
        .from(bucketName)
        .remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const timestamp = new Date().getTime();
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const urlWithCache = `${publicUrl}?t=${timestamp}`;
      setFormData(prev => ({ ...prev, [fieldName]: urlWithCache }));

      // Atualizar avatar_url no perfil do usuário logado
      if (type === 'avatar') {
        await supabase
          .from("profiles")
          .update({ avatar_url: urlWithCache })
          .eq("id", user.id);
      }

      toast({
        title: "Imagem atualizada com sucesso!",
        description: "A nova imagem já está visível",
      });

    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });

    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!user || !barbershopId) return;
    
    setSaving(true);
    
    try {
      // 1️⃣ Atualizar profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: formData.fullName,
          whatsapp: formData.whatsapp,
        });

      if (profileError) throw profileError;

      // 2️⃣ Atualizar barbershop (apenas se for owner)
      if (isOwner) {
        const { error: barbershopError } = await supabase
          .from("barbershops")
          .update({
            barbershop_name: formData.barbershopName,
            owner_accepts_appointments: formData.ownerAcceptsAppointments,
          })
          .eq("barber_id", barbershopId);

        if (barbershopError) throw barbershopError;
      }

      // 3️⃣ Recarregar dados
      await checkUser();

      toast({
        title: "Configurações salvas!",
        description: "Suas alterações foram aplicadas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Configurações</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Mostrar assinatura APENAS para owners */}
      {isOwner && (
        <div className="border-b border-border pb-6 mb-6">
          <h2 className="container text-2xl font-bold py-6 mb-3 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Sua Assinatura
          </h2>
          
          {subscription && (
            <Card className="container mx-auto px-4 py-8 max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg capitalize">{subscription.plan}</h3>
                  <p className="text-sm text-muted-foreground">
                    Status: <Badge className={
                      subscription.status === 'active' ? 'bg-green-500' :
                      subscription.status === 'trialing' ? 'bg-blue-500' :
                      subscription.status === 'past_due' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }>
                      {subscription.status === 'active' ? 'Ativo' :
                       subscription.status === 'trialing' ? 'Período de Teste' :
                       subscription.status === 'past_due' ? 'Pagamento Atrasado' :
                       'Cancelado'}
                    </Badge>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    R$ {subscription.plan === 'starter' ? '27' : 
                        subscription.plan === 'pro' ? '57' : '97'}
                  </p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <strong>Renovação:</strong>{' '}
                  {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                </p>
                {subscription.cancel_at_period_end && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      ⚠️ Sua assinatura será cancelada no fim do período atual
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open('https://billing.stripe.com/p/login/3cI6oG25w02o2J0fN0a3u00', '_blank');
                  }}
                >
                  Gerenciar Assinatura
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/signup")}
                >
                  Mudar de Plano
                </Button>
              </div>
            </Card>
          )}
          
          {!hasAccess && (
            <Alert variant="destructive">
              <AlertDescription>
                Sua assinatura expirou. Renove para continuar usando o AutoBarber.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8 border-border bg-card space-y-8">
          {/* Link Personalizado - Apenas para Owner */}
          {isOwner && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <LinkIcon className="h-6 w-6 text-primary" />
                Link Personalizado
              </h2>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O link é gerado automaticamente a partir do nome da sua barbearia. 
                  Para alterá-lo, mude o nome da barbearia abaixo e salve.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Seu Link Único (Gerado Automaticamente)</Label>
                <div className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {window.location.origin}/book/
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {formData.slug || "seu-link-aqui"}
                  </span>
                </div>
                {formData.slug && (
                  <p className="text-xs text-muted-foreground">
                    ✨ Este link é atualizado automaticamente quando você muda o nome da barbearia
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Foto de Perfil */}
          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold mb-6">Sua Foto</h2>
            
            <div className="flex flex-col items-center gap-4">
              {formData.avatarUrl ? (
                <img
                  src={formData.avatarUrl}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                  <User className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'avatar')}
                  disabled={uploading === 'avatar'}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Esta foto será exibida na página de agendamentos (Proporção 1:1)
                </p>
              </div>
            </div>
          </div>

          {/* Banner - Apenas para Owner */}
          {isOwner && (
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-primary" />
                Foto de Capa
              </h2>
              <div className="flex flex-col gap-4">
                {formData.bannerUrl ? (
                  <img
                    src={formData.bannerUrl}
                    alt="Banner"
                    className="w-full h-32 object-cover rounded-lg border-2 border-primary"
                  />
                ) : (
                  <div className="w-full h-32 bg-muted flex items-center justify-center rounded-lg border-2 border-border">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'banner')}
                    disabled={uploading === 'banner'}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Foto do ambiente da barbearia (Proporção 16:9)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Informações */}
          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold mb-6">Informações Pessoais</h2>
            <div className="space-y-4">
              {/* Nome da Barbearia - Apenas para Owner */}
              {isOwner && (
                <div className="space-y-2">
                  <Label htmlFor="barbershopName">Nome da Barbearia</Label>
                  <Input
                    id="barbershopName"
                    value={formData.barbershopName}
                    onChange={(e) => setFormData(prev => ({ ...prev, barbershopName: e.target.value }))}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Mudar o nome atualiza automaticamente seu link personalizado
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Seu Nome</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  className="bg-background"
                  placeholder="João Silva"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  className="bg-background"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Opção de Aceitar Agendamentos - Apenas para Owner */}
          {isOwner && (
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold mb-6">Preferências de Agendamento</h2>
              <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                <div>
                  <h3 className="font-semibold">Aceitar Agendamentos</h3>
                  <p className="text-sm text-muted-foreground">
                    Aparecer como opção de barbeiro na página de agendamentos
                  </p>
                </div>
                <Switch
                  checked={formData.ownerAcceptsAppointments}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, ownerAcceptsAppointments: checked }))
                  }
                />
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <Button onClick={handleSave} className="flex-1 shadow-gold" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Cancelar
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Settings;