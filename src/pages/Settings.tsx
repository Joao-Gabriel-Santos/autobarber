import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Settings, User, Image, Link, Info, CreditCard, ZoomIn, ZoomOut, Move } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions } = usePermissions();
  const [user, setUser] = useState<any>(null);
  const [barbershopId, setBarbershopId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Estados para o editor de banner
  const [bannerZoom, setBannerZoom] = useState(100);
  const [bannerPositionX, setBannerPositionX] = useState(50);
  const [bannerPositionY, setBannerPositionY] = useState(50);
  
  const [formData, setFormData] = useState({
    barbershopName: "",
    fullName: "",
    whatsapp: "",
    avatarUrl: "",
    bannerUrl: "",
    slug: "",
    antiFaltasEnabled: true,
    remindersEnabled: true,
    ownerAcceptsAppointments: true,
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
      
      let barbershopData = null;
      let targetId = user.id;
      
      if (profile?.role === 'barber' && profile.barbershop_id) {
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
        
        // Carregar configurações do banner
        if (barbershop.banner_zoom !== null && barbershop.banner_zoom !== undefined) {
          setBannerZoom(barbershop.banner_zoom);
        }
        if (barbershop.banner_position_x !== null && barbershop.banner_position_x !== undefined) {
          setBannerPositionX(barbershop.banner_position_x);
        }
        if (barbershop.banner_position_y !== null && barbershop.banner_position_y !== undefined) {
          setBannerPositionY(barbershop.banner_position_y);
        }
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

      if (type === 'avatar') {
        await supabase
          .from("profiles")
          .update({ avatar_url: urlWithCache })
          .eq("id", user.id);
      }

      // Reset banner position when uploading new banner
      if (type === 'banner') {
        setBannerZoom(100);
        setBannerPositionX(50);
        setBannerPositionY(50);
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

  const normalizeSlug = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleBarbershopNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      barbershopName: name,
      slug: normalizeSlug(name)
    }));
  };

  const handleSlugChange = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      slug: normalizeSlug(slug)
    }));
  };

  const handleSave = async () => {
    if (!user || !barbershopId) return;
    
    if (!formData.slug || formData.slug.trim() === '') {
      toast({
        title: "Slug inválido",
        description: "O link personalizado não pode estar vazio",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: formData.fullName,
          whatsapp: formData.whatsapp,
        });

      if (profileError) throw profileError;

      if (isOwner) {
        const { data: existingSlug } = await supabase
          .from("barbershops")
          .select("barber_id")
          .eq("slug", formData.slug)
          .neq("barber_id", barbershopId)
          .maybeSingle();

        if (existingSlug) {
          toast({
            title: "Link já em uso",
            description: "Este link personalizado já está sendo usado por outra barbearia. Escolha outro.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        const { error: barbershopError } = await supabase
          .from("barbershops")
          .update({
            barbershop_name: formData.barbershopName,
            slug: formData.slug,
            owner_accepts_appointments: formData.ownerAcceptsAppointments,
            banner_zoom: bannerZoom,
            banner_position_x: bannerPositionX,
            banner_position_y: bannerPositionY,
          })
          .eq("barber_id", barbershopId);

        if (barbershopError) throw barbershopError;
      }

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
              <Settings className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Configurações</h1>
            </div>
          </div>
        </div>
      </header>

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
            <div className="container mx-auto px-4 py-3 max-w-2xl">
              <Alert variant="destructive">
                <AlertDescription>
                  ⚠️ Sua assinatura expirou. Renove para continuar usando o AutoBarber.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8 border-border bg-card space-y-8">
          {isOwner && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Link className="h-6 w-6 text-primary" />
                Link Personalizado
              </h2>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O link é gerado automaticamente quando você digita o nome da barbearia, 
                  mas você pode editá-lo manualmente abaixo.
                </AlertDescription>
              </Alert>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Seu Link Personalizado</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {window.location.origin}/book/
                    </span>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="minha-barbearia"
                      className="bg-background font-medium text-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ✨ Use apenas letras minúsculas, números e hífens. 
                    Exemplo: barbearia-do-ze, cortes-premium, barbershop-2025
                  </p>
                </div>
                {formData.slug && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                    <p className="text-sm font-medium text-primary">
                      🔗 Link completo: {window.location.origin}/book/{formData.slug}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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
                  Esta foto será exibida na página de agendamentos
                </p>
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Image className="h-6 w-6 text-primary" />
                Foto de Capa (Banner)
              </h2>
              
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Esta imagem será exibida no topo da página de agendamentos. 
                  Use os controles abaixo para ajustar zoom e posição.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-6">
                {formData.bannerUrl ? (
                  <div className="space-y-6">
                    {/* Preview Mobile */}
                    <div>
                      <Label className="text-sm mb-2 block">Preview Mobile (360x200px)</Label>
                      <div className="relative w-full h-[200px] rounded-lg border-2 border-primary overflow-hidden bg-muted">
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundImage: `url(${formData.bannerUrl})`,
                            backgroundSize: `${bannerZoom}%`,
                            backgroundPosition: `${bannerPositionX}% ${bannerPositionY}%`,
                            backgroundRepeat: 'no-repeat',
                          }}
                        />
                      </div>
                    </div>

                    {/* Preview Desktop */}
                    <div>
                      <Label className="text-sm mb-2 block">Preview Desktop (1200x300px)</Label>
                      <div className="relative w-full h-[150px] md:h-[200px] rounded-lg border-2 border-primary overflow-hidden bg-muted">
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundImage: `url(${formData.bannerUrl})`,
                            backgroundSize: `${bannerZoom}%`,
                            backgroundPosition: `${bannerPositionX}% ${bannerPositionY}%`,
                            backgroundRepeat: 'no-repeat',
                          }}
                        />
                      </div>
                    </div>

                    {/* Controles de Ajuste - Accordion */}
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="banner-adjustments" className="border border-border rounded-lg bg-muted/50">
                        <AccordionTrigger className="px-6 hover:no-underline">
                          <span className="flex items-center gap-2 font-semibold">
                            <Move className="h-4 w-4" />
                            Ajustes do Banner
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                          <div className="space-y-6 pt-2">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                  <ZoomIn className="h-4 w-4" />
                                  Zoom: {bannerZoom}%
                                </Label>
                              </div>
                              <Slider
                                value={[bannerZoom]}
                                onValueChange={(value) => setBannerZoom(value[0])}
                                min={50}
                                max={200}
                                step={5}
                                className="w-full"
                              />
                              <p className="text-xs text-muted-foreground">
                                Aumente ou diminua o zoom da imagem
                              </p>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                  <Move className="h-4 w-4" />
                                  Posição Horizontal: {bannerPositionX}%
                                </Label>
                              </div>
                              <Slider
                                value={[bannerPositionX]}
                                onValueChange={(value) => setBannerPositionX(value[0])}
                                min={0}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                              <p className="text-xs text-muted-foreground">
                                Mova a imagem para esquerda ou direita
                              </p>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                  <Move className="h-4 w-4 rotate-90" />
                                  Posição Vertical: {bannerPositionY}%
                                </Label>
                              </div>
                              <Slider
                                value={[bannerPositionY]}
                                onValueChange={(value) => setBannerPositionY(value[0])}
                                min={0}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                              <p className="text-xs text-muted-foreground">
                                Mova a imagem para cima ou para baixo
                              </p>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBannerZoom(100);
                                setBannerPositionX(50);
                                setBannerPositionY(50);
                              }}
                              className="w-full"
                            >
                              Resetar Posição
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ) : (
                  <div className="w-full h-48 bg-muted flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border">
                    <Image className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Nenhum banner carregado</p>
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
                    📸 Recomendado: Imagem com pelo menos 1920x600px para melhor qualidade
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold mb-6">Informações Pessoais</h2>
            <div className="space-y-4">
              {isOwner && (
                <div className="space-y-2">
                  <Label htmlFor="barbershopName">Nome da Barbearia</Label>
                  <Input
                    id="barbershopName"
                    value={formData.barbershopName}
                    onChange={(e) => handleBarbershopNameChange(e.target.value)}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Ao mudar o nome, o link é atualizado automaticamente, mas você pode editá-lo depois
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

export default SettingsPage;