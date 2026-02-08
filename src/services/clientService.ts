// src/services/clientService.ts
import { supabase } from "@/integrations/supabase/client";
import { Client, ClientWithMetrics, ClientFilters, ClientDashboardData } from "@/types/client";
import { differenceInDays, startOfDay, parseISO } from "date-fns";

export class ClientService {
  /** Busca ou cria um cliente (upsert) */

  static async upsertClient(
    barbershopId: string,
    whatsapp: string,
    nome: string,
    dataNascimento?: string
  ): Promise<Client | null> {
    try {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("whatsapp", whatsapp)
        .maybeSingle();

      if (existingClient) {
        // Atualizar cliente existente
        const { data, error } = await supabase
          .from("clients")
          .update({
            nome,
            data_nascimento: dataNascimento || existingClient.data_nascimento,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingClient.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Criar novo cliente
      const { data, error } = await supabase
        .from("clients")
        .insert({
          barbershop_id: barbershopId,
          nome,
          whatsapp,
          data_nascimento: dataNascimento || null,
          total_cortes: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error in upsertClient:", error);
      return null;
    }
  }

  /**
   * Busca último serviço realizado por um cliente
   */
  static async getLastService(
    whatsapp: string,
    barbershopId: string
  ): Promise<any | null> {
    try {
      // Buscar último agendamento
      const { data: appointment } = await supabase
        .from("appointments")
        .select(`
          id,
          service_id,
          barber_id,
          appointment_date
        `)
        .eq("client_whatsapp", whatsapp)
        .eq("status", "completed")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!appointment) return null;

      // Buscar dados do serviço separadamente
      const { data: service } = await supabase
        .from("services")
        .select("id, name")
        .eq("id", appointment.service_id)
        .single();

      // Buscar dados do barbeiro separadamente
      const { data: barber } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", appointment.barber_id)
        .single();

      return {
        service_id: appointment.service_id,
        service_name: service?.name || "Serviço",
        barber_id: appointment.barber_id,
        barber_name: barber?.full_name || "Barbeiro",
      };
    } catch (error) {
      console.error("Error in getLastService:", error);
      return null;
    }
  }

  /**
   * Lista clientes com métricas
   */
  static async listClients(
    barbershopId: string,
    filters: ClientFilters = {}
  ): Promise<ClientWithMetrics[]> {
    try {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId);

      // Aplicar filtro de busca
      if (filters.search) {
        query = query.or(
          `nome.ilike.%${filters.search}%,whatsapp.ilike.%${filters.search}%`
        );
      }

      // Ordenação
      const sortBy = filters.sortBy || "nome";
      const sortOrder = filters.sortOrder || "asc";
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const { data: clients, error } = await query;

      if (error) throw error;
      if (!clients) return [];

      const today = startOfDay(new Date());
      const currentMonth = new Date().getMonth();

      // Processar métricas
      const clientsWithMetrics: ClientWithMetrics[] = clients.map((client) => {
        let dias_sem_corte: number | undefined;
        
        if (client.data_ultimo_corte) {
          const lastCutDate = startOfDay(parseISO(client.data_ultimo_corte));
          dias_sem_corte = differenceInDays(today, lastCutDate);
        }

        const proximo_beneficio = client.total_cortes
          ? 10 - (client.total_cortes % 10)
          : 10;

        let is_aniversariante = false;
        if (client.data_nascimento) {
          const birthDate = parseISO(client.data_nascimento);
          is_aniversariante = birthDate.getMonth() === currentMonth;
        }

        return {
          ...client,
          dias_sem_corte,
          proximo_beneficio,
          is_aniversariante,
        };
      });

      // Aplicar filtros adicionais
      let filtered = clientsWithMetrics;

      // ✅ CORREÇÃO: Incluir clientes que nunca cortaram (data_ultimo_corte = null) OU que passaram 30+ dias
      if (filters.inativos) {
        filtered = filtered.filter((c) => {
          // Cliente nunca cortou (data_ultimo_corte é null)
          if (c.data_ultimo_corte === null) {
            return true;
          }
          // Cliente cortou há mais de 30 dias
          return c.dias_sem_corte !== undefined && c.dias_sem_corte > 30;
        });
      }

      if (filters.aniversariantes) {
        filtered = filtered.filter((c) => c.is_aniversariante);
      }

      return filtered;
    } catch (error) {
      console.error("Error in listClients:", error);
      return [];
    }
  }

  /**
   * Busca estatísticas gerais dos clientes
   */
  static async getClientStats(barbershopId: string) {
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId);

      if (error) throw error;
      if (!clients) return null;

      const today = startOfDay(new Date());
      const currentMonth = new Date().getMonth();
      
      const clientes_ativos = clients.filter((c) => {
        if (!c.data_ultimo_corte) return false;
        const lastCutDate = startOfDay(parseISO(c.data_ultimo_corte));
        const daysSince = differenceInDays(today, lastCutDate);
        return daysSince <= 30;
      }).length;

      // ✅ CORREÇÃO: Inativos = sem último corte OU 30+ dias
      const clientes_inativos = clients.filter((c) => {
        // Nunca cortou
        if (!c.data_ultimo_corte) return true;
        
        // Cortou há mais de 30 dias
        const lastCutDate = startOfDay(parseISO(c.data_ultimo_corte));
        const daysSince = differenceInDays(today, lastCutDate);
        return daysSince > 30;
      }).length;

      const aniversariantes_mes = clients.filter((c) => {
        if (!c.data_nascimento) return false;
        const birthDate = parseISO(c.data_nascimento);
        return birthDate.getMonth() === currentMonth;
      }).length;

      return {
        total_clientes: clients.length,
        clientes_ativos,
        clientes_inativos,
        aniversariantes_mes,
      };
    } catch (error) {
      console.error("Error in getClientStats:", error);
      return null;
    }
  }

  /**
   * Busca dados do dashboard do cliente
   */
  static async getClientDashboard(
    whatsapp: string,
    barbershopId: string
  ): Promise<ClientDashboardData | null> {
    try {
      // Buscar cliente
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("whatsapp", whatsapp)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client) return null;

      // ✅ CORREÇÃO: Calcular dias_sem_corte com startOfDay
      let dias_sem_corte: number | undefined;
      if (client.data_ultimo_corte) {
        const today = startOfDay(new Date());
        const lastCutDate = startOfDay(parseISO(client.data_ultimo_corte));
        dias_sem_corte = differenceInDays(today, lastCutDate);
      }

      const clientWithMetrics: ClientWithMetrics = {
        ...client,
        dias_sem_corte,
      };

      // Buscar próximo agendamento (sem join complexo)
      const { data: nextAppointment } = await supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, price, status, service_id, barber_id")
        .eq("client_whatsapp", whatsapp)
        .in("status", ["pending", "confirmed"])
        .gte("appointment_date", new Date().toISOString().split("T")[0])
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      let proximo_agendamento = null;

      if (nextAppointment) {
        // Buscar dados do serviço separadamente
        const { data: service } = await supabase
          .from("services")
          .select("name")
          .eq("id", nextAppointment.service_id)
          .single();

        // Buscar dados do barbeiro separadamente
        const { data: barber } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", nextAppointment.barber_id)
          .single();

        proximo_agendamento = {
          id: nextAppointment.id,
          date: nextAppointment.appointment_date,
          time: nextAppointment.appointment_time,
          service_name: service?.name || "Serviço",
          barber_name: barber?.full_name || "Barbeiro",
          price: nextAppointment.price,
          status: nextAppointment.status,
        };
      }

      // Progresso de fidelidade (10 cortes = 1 grátis)
      const cortes_atuais = client.total_cortes % 10;
      const cortes_necessarios = 10;
      const progresso_percentual = (cortes_atuais / cortes_necessarios) * 100;

      // Cupom de aniversário
      let cupom_aniversario = null;
      if (client.data_nascimento) {
        const today = new Date();
        const birthDate = parseISO(client.data_nascimento);
        const isCurrentMonth = birthDate.getMonth() === today.getMonth();

        if (isCurrentMonth) {
          const endOfMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0
          );
          cupom_aniversario = {
            ativo: true,
            desconto: 20,
            valido_ate: endOfMonth.toISOString(),
          };
        }
      }

      return {
        client: clientWithMetrics,
        proximo_agendamento,
        progresso_fidelidade: {
          cortes_atuais,
          cortes_necessarios,
          progresso_percentual,
        },
        cupom_aniversario,
      };
    } catch (error) {
      console.error("Error in getClientDashboard:", error);
      return null;
    }
  }

  /**
   * Cancela um agendamento
   */
  static async cancelAppointment(appointmentId: string) {
    return await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);
  }
}

export class WhatsAppService {
  /**
   * Envia confirmação de agendamento via WhatsApp (simulado)
   */
  static async sendOTP(phoneNumber: string, code: string): Promise<boolean> {
    try {
      // Formatar número removendo caracteres especiais
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Mensagem do OTP
      const message = encodeURIComponent(
        `🔐 *Código de Verificação*\n\n` +
        `Seu código é: *${code}*\n\n` +
        `⏰ Válido por 5 minutos\n` +
        `❌ Não compartilhe este código com ninguém`
      );

      // Para desenvolvimento/teste, apenas loga no console
      console.log(`📱 OTP enviado para ${phoneNumber}: ${code}`);
      
      // Em produção, você integraria com API do WhatsApp aqui:
      // const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
      // await fetch('https://sua-api-whatsapp.com/send', { ... });
      
      return true;
      
    } catch (error) {
      console.error("Erro ao enviar OTP:", error);
      return false;
    }
  }

  /**
   * Envia confirmação de agendamento via WhatsApp (simulado)
   */
  static async sendAppointmentConfirmation(
    whatsapp: string,
    data: {
      service: string;
      date: string;
      time: string;
      barber: string;
    }
  ): Promise<void> {
    // Em produção, aqui você integraria com a API do WhatsApp
    console.log("📱 Enviando confirmação para:", whatsapp);
    console.log("📅 Agendamento:", data);
    
    // Simulação de envio bem-sucedido
    return Promise.resolve();
  }

  /**
   * Envia lembrete de agendamento
   */
  static async sendBookingReminder(
    phoneNumber: string,
    barbershopName: string,
    serviceName: string,
    date: string,
    time: string
  ): Promise<boolean> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      console.log(`⏰ Lembrete enviado para ${phoneNumber}`);
      console.log(`📅 ${barbershopName} - ${serviceName} - ${date} ${time}`);
      
      return true;
      
    } catch (error) {
      console.error("Erro ao enviar lembrete:", error);
      return false;
    }
  }

  /**
   * Envia notificação de cancelamento
   */
  static async sendCancellationNotice(
    phoneNumber: string,
    barbershopName: string,
    serviceName: string,
    date: string,
    time: string
  ): Promise<boolean> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      console.log(`❌ Cancelamento notificado para ${phoneNumber}`);
      console.log(`📅 ${barbershopName} - ${serviceName} - ${date} ${time}`);
      
      return true;
      
    } catch (error) {
      console.error("Erro ao enviar notificação de cancelamento:", error);
      return false;
    }
  }
};