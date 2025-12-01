-- Criar tabela de serviços
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL, -- duração em minutos
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de horários de funcionamento
CREATE TABLE public.working_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = domingo, 6 = sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(barber_id, day_of_week)
);

-- Criar tabela de agendamentos
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.barbershops (
  barber_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_name TEXT NOT NULL,
  barber_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_barbershops_updated_at
  BEFORE UPDATE ON public.barbershops
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Habilitar RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para services
CREATE POLICY "Barbeiros podem ver seus próprios serviços"
  ON public.services FOR SELECT
  USING (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem criar seus próprios serviços"
  ON public.services FOR INSERT
  WITH CHECK (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem atualizar seus próprios serviços"
  ON public.services FOR UPDATE
  USING (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem deletar seus próprios serviços"
  ON public.services FOR DELETE
  USING (auth.uid() = barber_id);

CREATE POLICY "Serviços são visíveis publicamente quando ativos"
  ON public.services FOR SELECT
  USING (active = true);

-- Políticas RLS para Barbearia
CREATE POLICY "Barbershops are public"
  ON public.barbershops
  FOR SELECT
  USING (true);

CREATE POLICY "Barber can update own shop"
  ON public.barbershops
  FOR UPDATE
  USING (auth.uid() = barber_id)
  WITH CHECK (auth.uid() = barber_id);

CREATE POLICY "Barber can insert own shop"
  ON public.barbershops
  FOR INSERT
  WITH CHECK (auth.uid() = barber_id);

-- Políticas RLS para working_hours
CREATE POLICY "Barbeiros podem ver seus próprios horários"
  ON public.working_hours FOR SELECT
  USING (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem criar seus próprios horários"
  ON public.working_hours FOR INSERT
  WITH CHECK (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem atualizar seus próprios horários"
  ON public.working_hours FOR UPDATE
  USING (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem deletar seus próprios horários"
  ON public.working_hours FOR DELETE
  USING (auth.uid() = barber_id);

CREATE POLICY "Horários são visíveis publicamente quando ativos"
  ON public.working_hours FOR SELECT
  USING (active = true);

-- Políticas RLS para appointments
CREATE POLICY "Barbeiros podem ver seus próprios agendamentos"
  ON public.appointments FOR SELECT
  USING (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem criar agendamentos"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem atualizar seus próprios agendamentos"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = barber_id)
  WITH CHECK (auth.uid() = barber_id);

CREATE POLICY "Barbeiros podem deletar seus próprios agendamentos"
  ON public.appointments FOR DELETE
  USING (auth.uid() = barber_id);

CREATE POLICY "Clientes podem criar agendamentos publicamente"
  ON public.appointments FOR INSERT
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();