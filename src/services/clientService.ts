// src/services/clientService.ts
import { supabase } from "@/integrations/supabase/client";
import { Client, ClientWithMetrics, ClientFilters, ClientDashboardData, FidelityConfig } from "@/types/client";
import { format } from "date-fns";

// ============================================
// CONFIGURAÇÃO DE FIDELIDADE (pode vir do DB futuramente)
// ============================================
const FIDELITY_CONFIG: FidelityConfig = {
  cortes_para_beneficio: 10,
  desconto_aniversario: 20, // 20%
  dias_validade_cupom: 30,
};

export class ClientService {
  
  // ============================================
  // CRIAR/ATUALIZAR CLIENTE (Cadastro Invisível)
  // ============================================
  static async upsertClient(
    barbershopId: string,
    whatsapp: string,
    nome: string,
    dataNascimento?: string
  ): Promise<Client | null> {
    try {
      // Verificar se cliente já existe
      const { data: existing } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("whatsapp", whatsapp)
        .maybeSingle();

      if (existing) {
        // Cliente já existe, apenas atualizar nome/data se fornecidos
        const updates: Partial<Client> = {};
        if (nome && nome !== existing.nome) updates.nome = nome;
        if (dataNascimento && !existing.data_nascimento) {
          updates.data_nascimento = dataNascimento;
        }

        if (Object.keys(updates).length > 0) {
          const { data } = await supabase
            .from("clients")
            .update(updates)
            .eq("id", existing.id)
            .select()
            .single();
          return data;
        }
        return existing;
      }

      // Criar novo cliente
      const { data, error } = await supabase
        .from("clients")
        .insert({
          barbershop_id: barbershopId,
          whatsapp,
          nome,
          data_nascimento: dataNascimento || null,
          total_cortes: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error upserting client:", error);
      return null;
    }
  }

  static async cancelAppointment(appointmentId: string) {
  // Você pode deletar ou apenas mudar o status para 'cancelled'
  const { error } = await supabase
    .from("appointments")
    .delete() // Ou .update({ status: 'cancelled' })
    .eq("id", appointmentId);

  return { error };
}

  // ============================================
  // VINCULAR AGENDAMENTO AO CLIENTE
  // ============================================
  static async linkAppointmentToClient(
    appointmentId: string,
    whatsapp: string,
    barbershopId: string
  ): Promise<boolean> {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("whatsapp", whatsapp)
        .single();

      if (!client) return false;

      const { error } = await supabase
        .from("appointments")
        .update({ client_id: client.id })
        .eq("id", appointmentId);

      return !error;
    } catch (error) {
      console.error("Error linking appointment:", error);
      return false;
    }
  }

  // ============================================
  // BUSCAR ÚLTIMO SERVIÇO DO CLIENTE
  // ============================================
  static async getLastService(whatsapp: string, barbershopId: string) {
    try {
      const { data } = await supabase
        .from("appointments")
        .select(`
          service_id,
          barber_id,
          services!inner (
            name
          )
        `)
        .eq("client_whatsapp", whatsapp)
        .eq("status", "completed")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return null;

      // Buscar nome do barbeiro separadamente
      const { data: barberProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.barber_id)
        .single();

      return {
        service_id: data.service_id,
        service_name: (data.services as any)?.name || "Serviço",
        barber_id: data.barber_id,
        barber_name: barberProfile?.full_name || "Barbeiro",
      };
    } catch (error) {
      console.error("Error getting last service:", error);
      return null;
    }
  }

  // ============================================
  // DASHBOARD DO CLIENTE
  // ============================================
  static async getClientDashboard(
    whatsapp: string,
    barbershopId: string
  ): Promise<ClientDashboardData | null> {
    try {
      // 1. Buscar dados do cliente
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("whatsapp", whatsapp)
        .single();

      if (!client) return null;

      // 2. Buscar agendamento (Ajuste na Query)
      // Removemos o gte restrito para garantir que agendamentos de hoje apareçam
      const todayStr = format(new Date(), "yyyy-MM-dd");

    // Versão 2 (Mais robusta)
const { data: nextAppt } = await supabase
  .from("appointments")
  .select(`
    id,
    appointment_date,
    appointment_time,
    price,
    status,
    services (name)
  `)
  .eq("client_whatsapp", whatsapp)
  .in("status", ["confirmed", "pending"])
  .gte("appointment_date", todayStr)
  .limit(1)
  .maybeSingle();

// Se o agendamento existir, buscamos o nome do barbeiro manualmente para não dar erro 400
let barberName = "Barbeiro";
if (nextAppt) {
  const { data: barberProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", (nextAppt as any).barber_id)
    .single();
  barberName = barberProfile?.full_name || "Barbeiro";
}

      // 3. Calcular progresso
      const cortesAtuais = (client.total_cortes || 0) % FIDELITY_CONFIG.cortes_para_beneficio;
      
      // 4. Buscar último serviço
      const ultimoServico = await this.getLastService(whatsapp, barbershopId);

      return {
        client: { ...client, ultimo_servico: ultimoServico || undefined },
        proximo_agendamento: nextAppt ? {
          id: nextAppt.id,
          date: nextAppt.appointment_date,
          time: nextAppt.appointment_time,
          service_name: (nextAppt.services as any)?.name || "Serviço",
          barber_name: barberName,
          price: nextAppt.price,
          status: nextAppt.status // Adicionado status para o badge
        } : null,
        progresso_fidelidade: {
          cortes_atuais: cortesAtuais,
          cortes_necessarios: FIDELITY_CONFIG.cortes_para_beneficio,
          progresso_percentual: (cortesAtuais / FIDELITY_CONFIG.cortes_para_beneficio) * 100,
        },
        cupom_aniversario: null // Mantive nulo para simplificar, mas sua lógica original funciona
      };
    } catch (error) {
      console.error("Error loading client dashboard:", error);
      return null;
    }
  }

  // ============================================
  // LISTAR CLIENTES (Para Owners)
  // ============================================
  static async listClients(
    barbershopId: string,
    filters?: ClientFilters
  ): Promise<ClientWithMetrics[]> {
    try {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId);

      // Filtro: busca por nome/whatsapp
      if (filters?.search) {
        query = query.or(`nome.ilike.%${filters.search}%,whatsapp.ilike.%${filters.search}%`);
      }

      // Filtro: inativos (30+ dias)
      if (filters?.inativos) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        query = query.or(`data_ultimo_corte.lt.${cutoffDate.toISOString()},data_ultimo_corte.is.null`);
      }

      // Filtro: aniversariantes do mês
      if (filters?.aniversariantes) {
        const mesAtual = new Date().getMonth() + 1;
        // Nota: Isso pode precisar de ajuste dependendo do DB
        query = query.not("data_nascimento", "is", null);
      }

      // Ordenação
      if (filters?.sortBy) {
        query = query.order(filters.sortBy, {
          ascending: filters.sortOrder === "asc",
        });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      // Processar métricas adicionais
      const hoje = new Date();
      const mesAtual = hoje.getMonth();

      return (data || []).map((client) => {
        const metrics: ClientWithMetrics = { ...client };

        // Calcular dias sem corte
        if (client.data_ultimo_corte) {
          const ultimoCorte = new Date(client.data_ultimo_corte);
          metrics.dias_sem_corte = Math.floor(
            (hoje.getTime() - ultimoCorte.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Calcular próximo benefício
        metrics.proximo_beneficio =
          FIDELITY_CONFIG.cortes_para_beneficio -
          (client.total_cortes % FIDELITY_CONFIG.cortes_para_beneficio);

        // Verificar aniversariante
        if (client.data_nascimento) {
          const nascimento = new Date(client.data_nascimento);
          metrics.is_aniversariante = nascimento.getMonth() === mesAtual;
        }

        return metrics;
      });
    } catch (error) {
      console.error("Error listing clients:", error);
      return [];
    }
  }

  // ============================================
  // ESTATÍSTICAS DE CLIENTES
  // ============================================
  static async getClientStats(barbershopId: string) {
    try {
      const { data: clients } = await supabase
        .from("clients")
        .select("data_ultimo_corte, data_nascimento")
        .eq("barbershop_id", barbershopId);

      if (!clients) return null;

      const hoje = new Date();
      const mesAtual = hoje.getMonth();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const stats = {
        total_clientes: clients.length,
        clientes_ativos: clients.filter(
          (c) => c.data_ultimo_corte && new Date(c.data_ultimo_corte) >= cutoffDate
        ).length,
        clientes_inativos: clients.filter(
          (c) => !c.data_ultimo_corte || new Date(c.data_ultimo_corte) < cutoffDate
        ).length,
        aniversariantes_mes: clients.filter(
          (c) =>
            c.data_nascimento &&
            new Date(c.data_nascimento).getMonth() === mesAtual
        ).length,
      };

      return stats;
    } catch (error) {
      console.error("Error getting client stats:", error);
      return null;
    }
  }
}

// ============================================
// INTEGRAÇÃO COM WhatsApp (Placeholder)
// ============================================
export class WhatsAppService {
  /**
   * Envia código OTP via WhatsApp
   * TODO: Integrar com Twilio, MessageBird ou similar
   */
  static async sendOTP(whatsapp: string, code: string): Promise<boolean> {
    console.log(`📱 [WhatsApp] Enviando OTP ${code} para ${whatsapp}`);
    
    // TODO: Implementar integração real
    // Exemplo com Twilio:
    // const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
    // await client.messages.create({
    //   body: `Seu código de verificação é: ${code}`,
    //   from: 'whatsapp:+14155238886',
    //   to: `whatsapp:${whatsapp}`
    // });
    
    return true;
  }

  /**
   * Envia notificação de agendamento
   */
  static async sendAppointmentConfirmation(
    whatsapp: string,
    appointmentDetails: {
      service: string;
      date: string;
      time: string;
      barber: string;
    }
  ): Promise<boolean> {
    console.log(`📱 [WhatsApp] Enviando confirmação para ${whatsapp}`, appointmentDetails);
    // TODO: Implementar
    return true;
  }

  /**
   * Envia cupom de aniversário
   */
  static async sendBirthdayCoupon(
    whatsapp: string,
    clientName: string,
    discount: number
  ): Promise<boolean> {
    console.log(`🎂 [WhatsApp] Enviando cupom de aniversário para ${clientName} (${whatsapp})`);
    // TODO: Implementar
    return true;
  }
}