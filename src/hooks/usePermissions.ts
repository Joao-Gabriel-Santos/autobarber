import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserPermissions {
  role: 'owner' | 'barber';
  canManageServices: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
  canViewFinance: boolean;
  canManageOwnSchedule: boolean;
  canViewOwnAppointments: boolean;
  barbershopId: string | null;
  ownerId: string | null; // ID do dono da barbearia
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, barbershop_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      const isOwner = profile.role === 'owner';
      
      // Se for barbeiro, pegar o ID do owner (barbershop_id é o ID do owner)
      const ownerId = isOwner ? user.id : profile.barbershop_id;

      setPermissions({
        role: profile.role as 'owner' | 'barber',
        canManageServices: isOwner, // Só owner gerencia serviços
        canManageTeam: isOwner, // Só owner gerencia equipe
        canManageSettings: isOwner, // Só owner gerencia configurações gerais
        canViewFinance: isOwner, // Só owner vê financeiro completo
        canManageOwnSchedule: true, // Todos podem gerenciar seus horários
        canViewOwnAppointments: true, // Todos veem seus agendamentos
        barbershopId: profile.barbershop_id,
        ownerId: ownerId,
      });
    } catch (error) {
      console.error("Error loading permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  return { permissions, loading, refetch: loadPermissions };
};