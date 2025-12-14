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

      setPermissions({
        role: profile.role as 'owner' | 'barber',
        canManageServices: isOwner,
        canManageTeam: isOwner,
        canManageSettings: isOwner,
        canViewFinance: isOwner,
        canManageOwnSchedule: true,
        canViewOwnAppointments: true,
        barbershopId: profile.barbershop_id,
      });
    } catch (error) {
      console.error("Error loading permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  return { permissions, loading, refetch: loadPermissions };
};