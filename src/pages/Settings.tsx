import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Settings as SettingsIcon, Upload, User, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    barbershopName: "",
    whatsapp: "",
    avatarUrl: "",
    bannerUrl: "",
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
      setFormData({
        barbershopName: user.user_metadata?.barbershop_name || "",
        whatsapp: user.user_metadata?.whatsapp || "",
        avatarUrl: user.user_metadata?.avatar_url || "",
        bannerUrl: user.user_metadata?.banner_url || "",
        antiFaltasEnabled: true,
        remindersEnabled: true,
      });
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
    const fileName = `${user.id}/${type}.png`; // NOME FIXO → substitui sempre

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        upsert: true,            // <- PERMITE sobrescrever
        contentType: file.type,  // <- garante exibição correta
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const fieldName = type === 'avatar' ? 'avatarUrl' : 'bannerUrl';
    setFormData(prev => ({ ...prev, [fieldName]: publicUrl }));

    await supabase.auth.updateUser({
      data: {
        [`${type}_url`]: publicUrl,
      }
    });

    toast({
      title: "Imagem enviada com sucesso!",
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
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          barbershop_name: formData.barbershopName,
          whatsapp: formData.whatsapp,
        }
      });

      if (error) throw error;

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
          {/* Profile Photos Section */}
          <div>
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
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  className="bg-background"
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
