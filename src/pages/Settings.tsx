import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Settings as SettingsIcon, User, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [barbershopId, setBarbershopId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);
  const [formData, setFormData] = useState({
    barbershopName: "",
    barberName: "",
    whatsapp: "",
    avatarUrl: "",
    bannerUrl: "",
    slug: "",
    antiFaltasEnabled: true,
    remindersEnabled: true,
  });

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
      
      // Buscar dados da barbearia usando barber_id
      const { data: barbershop, error: barbershopError } = await supabase
        .from("barbershops")
        .select("*")
        .eq("barber_id", user.id)
        .single();
      
      if (barbershopError) {
        console.error("Error loading barbershop:", barbershopError);
        toast({
          title: "Erro ao carregar dados",
          description: barbershopError.message,
          variant: "destructive",
        });
        return;
      }
      
      if (barbershop) {
        setBarbershopId(barbershop.barber_id); // O ID é o barber_id
        
        // Buscar URLs das imagens com cache-busting
        const timestamp = new Date().getTime();
        const { data: { publicUrl: avatarUrl } } = supabase
          .storage
          .from('avatars')
          .getPublicUrl(`${user.id}/avatar.png`);
        
        const { data: { publicUrl: bannerUrl } } = supabase
          .storage
          .from('banners')
          .getPublicUrl(`${user.id}/banner.png`);
        
        setFormData({
          barbershopName: barbershop.barbershop_name || "",
          barberName: barbershop.barber_name || "",
          whatsapp: user.user_metadata?.whatsapp || "",
          avatarUrl: `${avatarUrl}?t=${timestamp}`,
          bannerUrl: `${bannerUrl}?t=${timestamp}`,
          slug: barbershop.slug || "",
          antiFaltasEnabled: true,
          remindersEnabled: true,
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
    type: 'avatar' | 'banner'
  ) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    setUploading(type);

    try {
      const bucketName = type === 'avatar' ? 'avatars' : 'banners';
      const fileName = `${user.id}/${type}.png`;

      // Deletar a imagem antiga primeiro
      await supabase.storage
        .from(bucketName)
        .remove([fileName]);

      // Fazer upload da nova imagem
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Adicionar timestamp para forçar atualização do cache
      const timestamp = new Date().getTime();
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const urlWithCache = `${publicUrl}?t=${timestamp}`;
      const fieldName = type === 'avatar' ? 'avatarUrl' : 'bannerUrl';
      setFormData(prev => ({ ...prev, [fieldName]: urlWithCache }));

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

  const validateSlug = (slug: string): boolean => {
    // Slug deve ter apenas letras minúsculas, números e hífens
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
  };

  const handleSlugChange = (value: string) => {
    // Converter para formato válido automaticamente
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Substituir caracteres inválidos por hífen
      .replace(/-+/g, '-') // Remover hífens duplicados
      .replace(/^-|-$/g, ''); // Remover hífens do início e fim
    
    setFormData(prev => ({ ...prev, slug: normalized }));
  };

  const handleSaveSlug = async () => {
    if (!user || !barbershopId) return;

    if (!validateSlug(formData.slug)) {
      toast({
        title: "Slug inválido",
        description: "O slug deve ter entre 3 e 50 caracteres e conter apenas letras minúsculas, números e hífens.",
        variant: "destructive",
      });
      return;
    }

    setSavingSlug(true);

    try {
      // Verificar se o slug já existe
      const { data: existingBarbershop } = await supabase
        .from("barbershops")
        .select("barber_id")
        .eq("slug", formData.slug)
        .neq("barber_id", barbershopId)
        .single();

      if (existingBarbershop) {
        toast({
          title: "Slug já em uso",
          description: "Este slug já está sendo usado por outra barbearia. Escolha outro.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("barbershops")
        .update({ slug: formData.slug })
        .eq("barber_id", barbershopId);

      if (error) throw error;

      toast({
        title: "Slug atualizado!",
        description: "Seu link personalizado foi atualizado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar slug",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingSlug(false);
    }
  };

  const handleSave = async () => {
    try {
      // Atualizar no auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          whatsapp: formData.whatsapp,
        }
      });

      if (authError) throw authError;

      // Atualizar na tabela barbershops
      const { error: barbershopError } = await supabase
        .from("barbershops")
        .update({
          barbershop_name: formData.barbershopName,
          barber_name: formData.barberName,
        })
        .eq("barber_id", barbershopId);

      if (barbershopError) throw barbershopError;

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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8 border-border bg-card space-y-8">
          {/* Link Personalizado */}
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <LinkIcon className="h-6 w-6 text-primary" />
              Link Personalizado
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="slug">Seu Link Único</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Este será o link que seus clientes usarão para fazer agendamentos. 
                  Use apenas letras minúsculas, números e hífens.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-background border border-border rounded-md px-3">
                    <span className="text-muted-foreground text-sm">
                      {window.location.origin}/book/
                    </span>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="minha-barbearia"
                      className="border-0 p-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                  <Button onClick={handleSaveSlug} disabled={savingSlug}>
                    {savingSlug ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
                {formData.slug && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Seu link: <span className="text-primary font-medium">{window.location.origin}/book/{formData.slug}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold mb-6">Fotos da Barbearia</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Avatar Upload */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Foto de Perfil
                </Label>
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
                  <div className="flex flex-col gap-2 w-full">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'avatar')}
                      disabled={uploading === 'avatar'}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Logo ou foto do barbeiro
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner Upload */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Foto de Capa
                </Label>
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
                      Foto do ambiente da barbearia
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold mb-6">Informações da Barbearia</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barbershopName">Nome da Barbearia</Label>
                <Input
                  id="barbershopName"
                  value={formData.barbershopName}
                  onChange={(e) => setFormData(prev => ({ ...prev, barbershopName: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barberName">Nome do Barbeiro</Label>
                <Input
                  id="barberName"
                  value={formData.barberName}
                  onChange={(e) => setFormData(prev => ({ ...prev, barberName: e.target.value }))}
                  className="bg-background"
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

          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold mb-6">Automações</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                <div>
                  <h3 className="font-semibold">Sistema Anti-Faltas</h3>
                  <p className="text-sm text-muted-foreground">
                    Libera automaticamente horários não confirmados
                  </p>
                </div>
                <Switch
                  checked={formData.antiFaltasEnabled}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, antiFaltasEnabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                <div>
                  <h3 className="font-semibold">Lembretes Automáticos</h3>
                  <p className="text-sm text-muted-foreground">
                    Envia lembretes 24h e 1h antes do horário
                  </p>
                </div>
                <Switch
                  checked={formData.remindersEnabled}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, remindersEnabled: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <Button onClick={handleSave} className="flex-1 shadow-gold">
              Salvar Alterações
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