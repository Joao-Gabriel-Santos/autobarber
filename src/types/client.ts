// src/types/client.ts

export interface Client {
  id: string;
  barbershop_id: string;
  nome: string;
  whatsapp: string;
  data_nascimento: string | null;
  total_cortes: number;
  data_ultimo_corte: string | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientWithMetrics extends Client {
  dias_sem_corte?: number;
  proximo_beneficio?: number;
  is_aniversariante?: boolean;
  ultimo_servico?: {
    service_id: string;
    service_name: string;
    barber_id: string;
    barber_name: string;
  };
}

export interface ClientFilters {
  search?: string;
  inativos?: boolean; // 30+ dias sem corte
  aniversariantes?: boolean; // Aniversário no mês atual
  sortBy?: 'nome' | 'total_cortes' | 'data_ultimo_corte';
  sortOrder?: 'asc' | 'desc';
}

export interface FidelityConfig {
  cortes_para_beneficio: number; // Ex: 10 cortes = 1 grátis
  desconto_aniversario: number; // Ex: 20% no mês de aniversário
  dias_validade_cupom: number; // Ex: 30 dias
}

export interface ClientDashboardData {
  client: ClientWithMetrics;
  proximo_agendamento: {
    id: string;
    date: string;
    time: string;
    service_name: string;
    barber_name: string;
    price: number;
    status: string;
  } | null;
  progresso_fidelidade: {
    cortes_atuais: number;
    cortes_necessarios: number;
    progresso_percentual: number;
  };
  cupom_aniversario: {
    ativo: boolean;
    desconto: number;
    valido_ate: string;
  } | null;
}