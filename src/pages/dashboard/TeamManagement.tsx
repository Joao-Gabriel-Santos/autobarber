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
import { ArrowLeft, UserPlus, Mail, Clock, CheckCircle2, XCircle, Copy, Trash2, Edit, DollarSign, TrendingUp, Award, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  full_name: string;
  whatsapp: string;
  role: 'owner' | 'barber';
  created_at: string;
  email?: string;
}

interface Invite {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  invite_token: string;
  expires_at: string;
  created_at: string;
}

interface BarberCommission {
  barber_id: string;
  commission_rate: number;
  fixed_salary: number;
  payment_type: 'commission' | 'fixed' | 'mixed';
  notes: string;
}

interface BarberStats {
  id: string;
  name: string;
  total_appointments: number;
  total_revenue: number;
  commission_earned: number;
  avg_ticket: number;
  performance_score: number;
}

const TeamManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [barberStats, setBarberStats] = useState<BarberStats[]>([]);
  const [activeTab, setActiveTab] = useState("members");
  
  const [commissionData, setCommissionData] = useState({
    commission_rate: 50,
    fixed_salary: 0,
    payment_type: 'commission' as 'commission' | 'fixed' | 'mixed',
    notes: ''
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
      await loadBarberStats(user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async (userId: string) => {
    try {
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

      const profilesWithEmails: Profile[] = [];
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      for (const profile of profiles || []) {
        if (profile.id === currentUser?.id) {
          profilesWithEmails.push({
            ...profile,
            email: currentUser.email,
            role: profile.role as 'owner' | 'barber'
          });
        } else {
          profilesWithEmails.push({
            ...profile,
            email: "Email não disponível",
            role: profile.role as 'owner' | 'barber'
          });
        }
      }

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

  /**
   * CORREÇÃO: A query de comissão estava usando `.from("clients")` com campo `barber_id`
   * inexistente naquela tabela. Corrigido para `.from("barber_commissions")` com
   * os campos corretos da interface BarberCommission.
   */
  const loadBarberStats = async (ownerId: string) => {
    try {
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or(`id.eq.${ownerId},barbershop_id.eq.${ownerId}`);

      if (!members) return;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const stats: BarberStats[] = [];

      for (const barber of members) {
        // Buscar agendamentos concluídos do mês
        const { data: appointments } = await supabase
          .from("appointments")
          .select("id, price, status")
          .eq("barber_id", barber.id)
          .eq("status", "completed")
          .gte("appointment_date", format(monthStart, "yyyy-MM-dd"))
          .lte("appointment_date", format(monthEnd, "yyyy-MM-dd"));

        const totalAppointments = appointments?.length || 0;
        const totalRevenue = appointments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0;
        const avgTicket = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

        // CORREÇÃO: buscar configuração de comissão da tabela correta
        const { data: commissionConfig } = await supabase
          .from("barber_commissions")
          .select("commission_rate, fixed_salary, payment_type")
          .eq("barber_id", barber.id)
          .maybeSingle();

        let commissionEarned = 0;
        if (commissionConfig) {
          if (commissionConfig.payment_type === 'commission') {
            commissionEarned = totalRevenue * ((commissionConfig.commission_rate ?? 0) / 100);
          } else if (commissionConfig.payment_type === 'fixed') {
            commissionEarned = commissionConfig.fixed_salary ?? 0;
          } else if (commissionConfig.payment_type === 'mixed') {
            commissionEarned =
              (commissionConfig.fixed_salary ?? 0) +
              totalRevenue * ((commissionConfig.commission_rate ?? 0) / 100);
          }
        }

        const performanceScore = totalAppointments * 10 + avgTicket / 10;

        stats.push({
          id: barber.id,
          name: barber.full_name || "Sem nome",
          total_appointments: totalAppointments,
          total_revenue: totalRevenue,
          commission_earned: commissionEarned,
          avg_ticket: avgTicket,
          performance_score: performanceScore,
        });
      }

      stats.sort((a, b) => b.total_revenue - a.total_revenue);
      setBarberStats(stats);
    } catch (error: any) {
      console.error("Erro ao carregar estatísticas:", error);
      toast({
        title: "Erro ao carregar desempenho",
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
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

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

  const handleOpenCommissionDialog = async (barberId: string) => {
    setSelectedBarber(barberId);
    
    const { data: existing } = await supabase
      .from("barber_commissions")
      .select("*")
      .eq("barber_id", barberId)
      .maybeSingle();

    if (existing) {
      setCommissionData({
        commission_rate: existing.commission_rate ?? 50,
        fixed_salary: existing.fixed_salary ?? 0,
        payment_type: existing.payment_type as 'commission' | 'fixed' | 'mixed',
        notes: existing.notes || ''
      });
    } else {
      setCommissionData({
        commission_rate: 50,
        fixed_salary: 0,
        payment_type: 'commission',
        notes: ''
      });
    }

    setCommissionDialogOpen(true);
  };

  const handleSaveCommission = async () => {
    if (!selectedBarber) return;

    try {
      const { data: existing } = await supabase
        .from("barber_commissions")
        .select("id")
        .eq("barber_id", selectedBarber)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("barber_commissions")
          .update(commissionData)
          .eq("barber_id", selectedBarber);
      } else {
        await supabase
          .from("barber_commissions")
          .insert({
            barber_id: selectedBarber,
            ...commissionData
          });
      }

      toast({
        title: "Comissão atualizada!",
        description: "As configurações foram salvas com sucesso",
      });

      setCommissionDialogOpen(false);
      await loadBarberStats(user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar comissão",
        description: error.message,
        variant: "destructive",
      });
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

      toast({ title: "Convite removido" });

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
    if (!confirm("Tem certeza que deseja remover este barbeiro da equipe?")) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: 'owner', barbershop_id: null })
        .eq("id", memberId);

      if (error) throw error;

      toast({ title: "Barbeiro removido da equipe" });

      if (user) {
        await loadTeamMembers(user.id);
        await loadBarberStats(user.id);
      }
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
                  Gerencie barbeiros, comissões e desempenho
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

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">Equipe</TabsTrigger>
            <TabsTrigger value="performance">Desempenho</TabsTrigger>
            <TabsTrigger value="invites">Convites</TabsTrigger>
          </TabsList>

          {/* Aba de Membros */}
          <TabsContent value="members" className="space-y-4">
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
                    <div className="flex gap-2">
                      {member.role === 'barber' && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenCommissionDialog(member.id)}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>WhatsApp: {member.whatsapp || 'Não informado'}</p>
                    <p>Desde: {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Aba de Desempenho */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4">
              {barberStats.map((barber, index) => (
                <Card key={barber.id} className="p-6 border-border bg-card hover:border-primary/50 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{barber.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Período: {format(startOfMonth(new Date()), "dd/MM")} - {format(endOfMonth(new Date()), "dd/MM")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCommissionDialog(barber.id)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Comissão
                    </Button>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <p className="text-xs text-muted-foreground">Receita Gerada</p>
                      </div>
                      <p className="text-xl font-bold text-primary">
                        R$ {barber.total_revenue.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Percent className="h-4 w-4 text-green-500" />
                        <p className="text-xs text-muted-foreground">A Receber</p>
                      </div>
                      <p className="text-xl font-bold text-green-500">
                        R$ {barber.commission_earned.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <p className="text-xs text-muted-foreground">Atendimentos</p>
                      </div>
                      <p className="text-xl font-bold">
                        {barber.total_appointments}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Award className="h-4 w-4 text-orange-500" />
                        <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      </div>
                      <p className="text-xl font-bold">
                        R$ {barber.avg_ticket.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}

              {barberStats.length === 0 && (
                <Card className="p-12 text-center border-border bg-card">
                  <p className="text-muted-foreground">
                    Nenhum dado de desempenho disponível ainda.
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Aba de Convites */}
          <TabsContent value="invites" className="space-y-4">
            {invites.length > 0 ? (
              invites.map((invite) => (
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
              ))
            ) : (
              <Card className="p-12 text-center border-border bg-card">
                <p className="text-muted-foreground">
                  Nenhum convite enviado ainda.
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog de Comissão */}
        <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configurar Comissão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Pagamento</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button
                    variant={commissionData.payment_type === 'commission' ? 'default' : 'outline'}
                    onClick={() => setCommissionData({ ...commissionData, payment_type: 'commission' })}
                  >
                    Comissão
                  </Button>
                  <Button
                    variant={commissionData.payment_type === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setCommissionData({ ...commissionData, payment_type: 'fixed' })}
                  >
                    Fixo
                  </Button>
                  <Button
                    variant={commissionData.payment_type === 'mixed' ? 'default' : 'outline'}
                    onClick={() => setCommissionData({ ...commissionData, payment_type: 'mixed' })}
                  >
                    Misto
                  </Button>
                </div>
              </div>

              {(commissionData.payment_type === 'commission' || commissionData.payment_type === 'mixed') && (
                <div>
                  <Label htmlFor="commission_rate">Porcentagem de Comissão (%)</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    value={commissionData.commission_rate}
                    onChange={(e) => setCommissionData({ ...commissionData, commission_rate: parseFloat(e.target.value) })}
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ex: 50% significa que o barbeiro recebe metade do valor de cada serviço
                  </p>
                </div>
              )}

              {(commissionData.payment_type === 'fixed' || commissionData.payment_type === 'mixed') && (
                <div>
                  <Label htmlFor="fixed_salary">Salário Fixo (R$)</Label>
                  <Input
                    id="fixed_salary"
                    type="number"
                    value={commissionData.fixed_salary}
                    onChange={(e) => setCommissionData({ ...commissionData, fixed_salary: parseFloat(e.target.value) })}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={commissionData.notes}
                  onChange={(e) => setCommissionData({ ...commissionData, notes: e.target.value })}
                  placeholder="Detalhes do acordo, condições especiais..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveCommission} className="flex-1">
                  Salvar Configuração
                </Button>
                <Button variant="outline" onClick={() => setCommissionDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default TeamManagement;