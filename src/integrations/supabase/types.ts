export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      barber_commissions: {
        Row: {
          id: string
          barber_id: string
          payment_type: 'commission' | 'fixed' | 'mixed'
          commission_rate: number
          fixed_salary: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          payment_type?: 'commission' | 'fixed' | 'mixed'
          commission_rate?: number
          fixed_salary?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          payment_type?: 'commission' | 'fixed' | 'mixed'
          commission_rate?: number
          fixed_salary?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_commissions_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          barbershop_id: string
          nome: string
          whatsapp: string
          data_nascimento: string | null
          email: string | null
          notes: string | null
          total_cortes: number
          data_ultimo_corte: string | null
          auth_user_id: string | null
          created_at: string 
          updated_at: string
        }
        Insert: {
          id?: string
          barbershop_id: string
          nome: string
          whatsapp: string
          data_nascimento?: string | null
          email?: string | null
          notes?: string | null
          total_cortes?: number
          data_ultimo_corte?: string | null
          auth_user_id?: string | null
          created_at?: string 
          updated_at?: string
        }
        Update: {
          id?: string
          barbershop_id?: string
          nome?: string
          whatsapp?: string
          data_nascimento?: string | null
          email?: string | null
          notes?: string | null
          total_cortes?: number
          data_ultimo_corte?: string | null
          auth_user_id?: string | null
          created_at?: string 
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "breaks_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          barber_id: string
          service_id: string
          client_name: string
          client_whatsapp: string
          client_email: string | null
          client_birthday: string | null
          appointment_date: string
          appointment_time: string
          status: string
          price: number
          services_data: Json | null
          payment_method: 'pix' | 'dinheiro' | 'cartao' | null
          created_at: string
          updated_at: string
          client_id: string | null
        }
        Insert: {
          id?: string
          barber_id: string
          service_id: string
          client_name: string
          client_whatsapp: string
          client_email?: string | null
          client_birthday?: string | null
          appointment_date: string
          appointment_time: string
          status?: string
          price: number
          services_data?: Json | null
          payment_method?: 'pix' | 'dinheiro' | 'cartao' | null
          created_at?: string
          updated_at?: string
          client_id?: string | null
        }
        Update: {
          id?: string
          barber_id?: string
          service_id?: string
          client_name?: string
          client_whatsapp?: string
          client_email?: string | null
          client_birthday?: string | null
          appointment_date?: string
          appointment_time?: string
          status?: string
          price?: number
          services_data?: Json | null
          payment_method?: 'pix' | 'dinheiro' | 'cartao' | null
          created_at?: string
          updated_at?: string
          client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
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
          banner_position_x: number
          banner_position_y: number
          banner_zoom: number
        }
        Insert: {
          barber_id: string
          barbershop_name: string
          created_at?: string
          updated_at?: string
          slug?: string
          owner_accepts_appointments?: boolean
          banner_position_x?: number
          banner_position_y?: number
          banner_zoom?: number
        }
        Update: {
          barber_id?: string
          barbershop_name?: string
          created_at?: string
          updated_at?: string
          slug?: string
          owner_accepts_appointments?: boolean
          banner_position_x?: number
          banner_position_y?: number
          banner_zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "barbershops_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          role: string
          barbershop_id: string | null
          full_name: string | null
          whatsapp: string | null
          avatar_url: string | null
          commission_percentage: number | null
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
          commission_percentage?: number | null
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
          commission_percentage?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
          cancel_at_period_end?: boolean
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
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_barbershop_by_slug: {
        Args: { slug_param: string }
        Returns: Array<{
          barber_id: string
          barbershop_name: string
          barber_name: string
          slug: string
        }>
      }
      accept_barber_invite: {
        Args: {
          p_invite_token: string
          p_user_id: string
        }
        Returns: {
          success: boolean
          error?: string
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