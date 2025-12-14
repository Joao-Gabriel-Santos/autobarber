import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, UserPlus, Mail, Clock, CheckCircle2, XCircle, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
  id: string;
  full_name: string;
  whatsapp: string;
  role: 'owner' | 'barber';
  created_at: string;
  email?: string; // Será buscado separadamente
}

interface Invite {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  invite_token: string;
  expires_at: string;
  created_at: string;
}

const TeamManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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

      // Verificar se é owner
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== 'owner') {
        toast({
          title: "Acesso negado",
          description: "Apenas donos podem acessar esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setUser(user);
      await loadTeamMembers(user.id);
      await loadInvites(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async (userId: string) => {
    try {
      // Buscar perfis (dono + barbeiros da equipe)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, whatsapp, role, created_at, barbershop_id")
        .or(`id.eq.${userId},barbershop_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading profiles:", error);
        toast({
          title: "Erro ao carregar equipe",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Adicionar email apenas para o usuário logado
      const profilesWithEmails: Profile[] = [];
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Assumindo que este é o trecho de código que está causando o erro
    const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from("profiles")
        .select('*')
        .eq("id", userId)
        .maybeSingle();

    if (data) {
        // AQUI ESTÁ O ERRO: data é {..., role: string}, mas o estado espera Profile (role: 'owner'|'barber')
        setProfile(data as Profile); // <-- Corrija aplicando a asserção
    }
};

      setTeamMembers(profilesWithEmails);
    } catch (error: any) {
      console.error("Error loading team:", error);
      toast({
        title: "Erro ao carregar equipe",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadInvites = async (userId: string) => {
    const { data, error } = await supabase
      .from("barber_invites")
      .select("*")
      .eq("barbershop_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading invites:", error);
      return;
    }

    setInvites((data as unknown as Invite[]) || []);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !user) return;

    setInviting(true);
    try {
      // Gerar token único
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

      const { error } = await supabase
        .from("barber_invites")
        .insert({
          barbershop_id: user.id,
          email: inviteEmail,
          invite_token: token,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Convite criado!",
        description: `Link de convite gerado para ${inviteEmail}`,
      });

      setInviteEmail("");
      setDialogOpen(false);
      await loadInvites(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao criar convite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/accept-invite/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link do convite copiado para área de transferência",
    });
  };

  const deleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("barber_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;

      toast({
        title: "Convite removido",
      });

      if (user) await loadInvites(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao remover convite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Tem certeza que deseja remover este barbeiro da equipe?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: 'owner',
          barbershop_id: null
        })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Barbeiro removido da equipe",
      });

      if (user) await loadTeamMembers(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao remover barbeiro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-gradient-gold animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gerenciar Equipe</h1>
                <p className="text-sm text-muted-foreground">
                  Adicione e gerencie barbeiros da sua equipe
                </p>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-gold">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Barbeiro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar Novo Barbeiro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email do Barbeiro</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="barbeiro@email.com"
                    />
                  </div>
                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertDescription>
                      Um link de convite será gerado. Compartilhe-o com o barbeiro para que ele possa aceitar.
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={handleSendInvite}
                    disabled={inviting || !inviteEmail}
                    className="w-full"
                  >
                    {inviting ? "Criando..." : "Gerar Link de Convite"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Membros da Equipe */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Equipe Atual</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} className="p-6 border-border bg-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">
                      {member.full_name || "Sem nome"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {member.email}
                    </p>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role === 'owner' ? 'Dono' : 'Barbeiro'}
                    </Badge>
                  </div>
                  {member.role === 'barber' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>WhatsApp: {member.whatsapp || 'Não informado'}</p>
                  <p>Desde: {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Convites Pendentes */}
        {invites.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Convites Enviados</h2>
            <div className="space-y-4">
              {invites.map((invite) => (
                <Card key={invite.id} className="p-6 border-border bg-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invite.email}</span>
                        <Badge
                          variant={
                            invite.status === 'accepted' ? 'default' :
                            invite.status === 'expired' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {invite.status === 'accepted' ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Aceito</>
                          ) : invite.status === 'expired' ? (
                            <><XCircle className="h-3 w-3 mr-1" /> Expirado</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Pendente</>
                          )}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Criado: {format(new Date(invite.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        <p>Expira: {format(new Date(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {invite.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInviteLink(invite.invite_token)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar Link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInvite(invite.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TeamManagement;