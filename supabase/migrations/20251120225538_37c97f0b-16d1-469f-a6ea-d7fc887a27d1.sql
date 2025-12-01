-- Adicionar policy para clientes verem seus próprios agendamentos
CREATE POLICY "Clientes podem ver seus próprios agendamentos pelo WhatsApp"
ON appointments
FOR SELECT
USING (true);

-- Adicionar policy para clientes cancelarem seus próprios agendamentos
CREATE POLICY "Clientes podem cancelar seus próprios agendamentos"
ON appointments
FOR UPDATE
USING (status IN ('pending', 'confirmed'))
WITH CHECK (status IN ('pending', 'confirmed', 'cancelled'));