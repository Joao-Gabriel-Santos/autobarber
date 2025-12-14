-- Criar enum para roles
CREATE TYPE user_role AS ENUM ('owner', 'barber');

-- Adicionar coluna role na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'owner',
ADD COLUMN IF NOT EXISTS barbershop_id UUID REFERENCES public.barbershops(barber_id) ON DELETE CASCADE;

-- Criar tabela de convites de barbeiros
CREATE TABLE IF NOT EXISTS public.barber_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(barber_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invite_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_barbershop_id ON public.profiles(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_barber_invites_barbershop_id ON public.barber_invites(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_barber_invites_token ON public.barber_invites(invite_token);

-- RLS para barber_invites
ALTER TABLE public.barber_invites ENABLE ROW LEVEL SECURITY;

-- Política: Donos podem ver convites de sua barbearia
CREATE POLICY "Owners can view their barbershop invites"
  ON public.barber_invites FOR SELECT
  USING (
    barbershop_id IN (
      SELECT barber_id FROM public.barbershops 
      WHERE barber_id = auth.uid()
    )
  );

-- Política: Donos podem criar convites
CREATE POLICY "Owners can create invites"
  ON public.barber_invites FOR INSERT
  WITH CHECK (
    barbershop_id IN (
      SELECT barber_id FROM public.barbershops 
      WHERE barber_id = auth.uid()
    )
  );

-- Política: Donos podem atualizar convites
CREATE POLICY "Owners can update their invites"
  ON public.barber_invites FOR UPDATE
  USING (
    barbershop_id IN (
      SELECT barber_id FROM public.barbershops 
      WHERE barber_id = auth.uid()
    )
  );

-- Política: Convites públicos podem ser vistos por token
CREATE POLICY "Public can view invites by token"
  ON public.barber_invites FOR SELECT
  USING (true);

-- Atualizar políticas de services para incluir barbeiros da equipe
DROP POLICY IF EXISTS "Barbeiros podem ver seus próprios serviços" ON public.services;
DROP POLICY IF EXISTS "Barbeiros podem criar seus próprios serviços" ON public.services;
DROP POLICY IF EXISTS "Barbeiros podem atualizar seus próprios serviços" ON public.services;
DROP POLICY IF EXISTS "Barbeiros podem deletar seus próprios serviços" ON public.services;
DROP POLICY IF EXISTS "Serviços são visíveis publicamente quando ativos" ON public.services;
DROP POLICY IF EXISTS "Owners can manage services" ON public.services;
DROP POLICY IF EXISTS "Barbers can view barbershop services" ON public.services;

-- Nova política: Donos podem gerenciar serviços
CREATE POLICY "Owners can manage services"
  ON public.services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'owner'
      AND profiles.id = services.barber_id
    )
  );

-- Nova política: Barbeiros podem ver serviços da barbearia
CREATE POLICY "Barbers can view barbershop services"
  ON public.services FOR SELECT
  USING (
    barber_id IN (
      SELECT barbershop_id FROM public.profiles 
      WHERE id = auth.uid()
    )
    OR active = true
  );

-- Atualizar políticas de working_hours
DROP POLICY IF EXISTS "Barbeiros podem ver seus próprios horários" ON public.working_hours;
DROP POLICY IF EXISTS "Barbeiros podem criar seus próprios horários" ON public.working_hours;
DROP POLICY IF EXISTS "Barbeiros podem atualizar seus próprios horários" ON public.working_hours;
DROP POLICY IF EXISTS "Barbeiros podem deletar seus próprios horários" ON public.working_hours;
DROP POLICY IF EXISTS "Horários são visíveis publicamente quando ativos" ON public.working_hours;
DROP POLICY IF EXISTS "Users can manage their own working hours" ON public.working_hours;
DROP POLICY IF EXISTS "Owners can view team working hours" ON public.working_hours;

-- Nova política: Todos podem gerenciar seus próprios horários
CREATE POLICY "Users can manage their own working hours"
  ON public.working_hours FOR ALL
  USING (auth.uid() = barber_id)
  WITH CHECK (auth.uid() = barber_id);

-- Nova política: Donos podem ver horários de toda equipe
CREATE POLICY "Owners can view team working hours"
  ON public.working_hours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.barbershop_id = p2.barbershop_id
      WHERE p1.id = auth.uid() 
      AND p1.role = 'owner'
      AND p2.id = working_hours.barber_id
    )
  );

-- Política pública para clientes verem horários
CREATE POLICY "Public can view active working hours"
  ON public.working_hours FOR SELECT
  USING (active = true);

-- Atualizar políticas de appointments
DROP POLICY IF EXISTS "Barbeiros podem ver seus próprios agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Barbeiros podem criar agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Barbeiros podem atualizar seus próprios agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Barbeiros podem deletar seus próprios agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem criar agendamentos publicamente" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem ver seus próprios agendamentos pelo WhatsApp" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem cancelar seus próprios agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Barbers can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Owners can view barbershop appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barbers can update their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Owners can manage barbershop appointments" ON public.appointments;

-- Nova política: Barbeiros veem seus próprios agendamentos
CREATE POLICY "Barbers can view their own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = barber_id);

-- Nova política: Donos veem agendamentos da barbearia toda
CREATE POLICY "Owners can view barbershop appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
      AND profiles.id = appointments.barber_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.barbershop_id = p2.barbershop_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'owner'
      AND p2.id = appointments.barber_id
    )
  );

-- Nova política: Barbeiros podem atualizar seus agendamentos
CREATE POLICY "Barbers can update their appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = barber_id)
  WITH CHECK (auth.uid() = barber_id);

-- Nova política: Donos podem gerenciar agendamentos da barbearia
CREATE POLICY "Owners can manage barbershop appointments"
  ON public.appointments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
      AND profiles.id = appointments.barber_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.barbershop_id = p2.barbershop_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'owner'
      AND p2.id = appointments.barber_id
    )
  );

-- Políticas públicas para clientes
CREATE POLICY "Public can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can view appointments by whatsapp"
  ON public.appointments FOR SELECT
  USING (true);

CREATE POLICY "Clients can cancel their appointments"
  ON public.appointments FOR UPDATE
  USING (status IN ('pending', 'confirmed'))
  WITH CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- Trigger para expirar convites automaticamente
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS void AS $$
BEGIN
  UPDATE public.barber_invites
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Função para aceitar convite
CREATE OR REPLACE FUNCTION public.accept_barber_invite(
  p_invite_token TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Buscar convite
  SELECT * INTO v_invite
  FROM public.barber_invites
  WHERE invite_token = p_invite_token
  AND status = 'pending'
  AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Convite inválido ou expirado'
    );
  END IF;

  -- Atualizar profile do barbeiro
  UPDATE public.profiles
  SET 
    role = 'barber',
    barbershop_id = v_invite.barbershop_id
  WHERE id = p_user_id;

  -- Marcar convite como aceito
  UPDATE public.barber_invites
  SET status = 'accepted'
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'barbershop_id', v_invite.barbershop_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar políticas de profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Nova política: Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Nova política: Donos podem ver perfis da equipe
CREATE POLICY "Owners can view team profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles owner
      WHERE owner.id = auth.uid()
      AND owner.role = 'owner'
      AND owner.id = profiles.barbershop_id
    )
  );

-- Nova política: Usuários podem atualizar próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Nova política: Usuários podem inserir próprio perfil
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Atualizar políticas de barbershops
DROP POLICY IF EXISTS "Barber can update own shop" ON public.barbershops;
DROP POLICY IF EXISTS "Barbershops are public" ON public.barbershops;
DROP POLICY IF EXISTS "Barber can insert own shop" ON public.barbershops;
DROP POLICY IF EXISTS "Owners can update barbershop" ON public.barbershops;

-- Política: Barbearias são públicas
CREATE POLICY "Barbershops are public"
  ON public.barbershops
  FOR SELECT
  USING (true);

-- Nova política: Apenas donos podem atualizar barbearia
CREATE POLICY "Owners can update barbershop"
  ON public.barbershops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
      AND profiles.id = barbershops.barber_id
    )
  );

-- Política: Donos podem inserir barbearia
CREATE POLICY "Owners can insert barbershop"
  ON public.barbershops FOR INSERT
  WITH CHECK (auth.uid() = barber_id);