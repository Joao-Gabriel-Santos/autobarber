export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          barbershop_id: string
          nome: string
          whatsapp: string
          data_nascimento: string //
          total_cortes: string //
          data_ultimo_corte: string //
          auth_user_id: string
          created_at: string 
          updated_at: string

        }
        Insert: {
          id?: string
          barbershop_id?: string
          nome?: string
          whatsapp?: string
          data_nascimento?: string //
          total_cortes?: string //
          data_ultimo_corte?: string //
          auth_user_id?: string
          created_at?: string 
          updated_at?: string
        }
        Uptade: {
          id?: string
          barbershop_id?: string
          nome?: string
          whatsapp?: string
          data_nascimento?: string //
          total_cortes?: string //
          data_ultimo_corte?: string //
          auth_user_id?: string
          created_at?: string 
          updated_at?: string
        }
        Relationships: []
      }
      barber_invites: {
        Row: {
          id: string
          barbershop_id: string
          email: string
          status: string
          invite_token: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barbershop_id: string
          email: string
          status?: string
          invite_token: string
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barbershop_id?: string
          email?: string
          status?: string
          invite_token?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_invites_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["barber_id"]
          },
        ]
      }
      breaks: {
        Row: {
          id: string
          barber_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          created_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          barber_id: string
          service_id: string
          client_name: string
          client_whatsapp: string
          appointment_date: string
          appointment_time: string
          status: string
          price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          service_id: string
          client_name: string
          client_whatsapp: string
          appointment_date: string
          appointment_time: string
          status?: string
          price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          service_id?: string
          client_name?: string
          client_whatsapp?: string
          appointment_date?: string
          appointment_time?: string
          status?: string
          price?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops: {
        Row: {
          barber_id: string
          barbershop_name: string
          created_at: string
          updated_at: string
          slug: string
          owner_accepts_appointments: boolean
          banner_position_x: number;
          banner_position_y: number;
          banner_zoom: number;
        }
        Insert: {
          barber_id: string
          barbershop_name: string
          created_at?: string
          updated_at?: string
          slug?: string
          owner_accepts_appointments?: boolean
          banner_position_x?: number;
          banner_position_y?: number;
          banner_zoom?: number;
        }
        Update: {
          barber_id?: string
          barbershop_name?: string
          created_at?: string
          updated_at?: string
          slug?: string
          owner_accepts_appointments?: boolean
          banner_position_x?: number;
          banner_position_y?: number;
          banner_zoom?: number;
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: string
          barbershop_id: string | null
          full_name: string | null
          whatsapp: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          barbershop_id?: string | null
          role?: string
          full_name?: string | null
          whatsapp?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: string
          barbershop_id?: string | null
          full_name?: string | null
          whatsapp?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          barber_id: string
          name: string
          duration: number
          price: number
          active: boolean
          created_at: string
          updated_at: string
          image_url: string | null
        }
        Insert: {
          id?: string
          barber_id: string
          name: string
          duration: number
          price: number
          active?: boolean
          created_at?: string
          updated_at?: string
          image_url?: string | null
        }
        Update: {
          id?: string
          barber_id?: string
          name?: string
          duration?: number
          price?: number
          active?: boolean
          created_at?: string
          updated_at?: string
          image_url?: string | null
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          id: string
          barber_id: string
          day_of_week: number
          start_time: string
          end_time: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          day_of_week: number
          start_time?: string
          end_time?: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string 
          user_id: string 
          stripe_customer_id: string 
          stripe_subscription_id: string 
          plan: string 
          status: string 
          current_period_start: string 
          current_period_end: string 
          created_at: string 
          updated_at: string 
          cancel_at_period_end: boolean
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id: string 
          stripe_subscription_id: string 
          plan: string 
          status: string 
          current_period_start: string 
          current_period_end: string 
          created_at?: string
          updated_at?: string
          cancel_at_period_end: boolean
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          plan?: string
          status?: string
          current_period_start?: string
          current_period_end?: string 
          created_at?: string
          updated_at?: string 
          cancel_at_period_end?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_barbershop_by_slug: {
        Args: { slug_param: string }
        Returns: BarbershopData[]
      }
      accept_barber_invite: {
        Args: {
          p_invite_token: string,
          p_user_id: string
        }
        Returns: {
          success: boolean;
          error?: string;
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Custom types
type BarbershopData = {
  barber_id: string;
  barbershop_name: string;
  barber_name: string;
  slug: string;
}