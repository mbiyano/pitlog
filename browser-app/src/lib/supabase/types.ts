export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          workshop_id: string | null
          role: 'owner' | 'admin' | 'mechanic'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          workshop_id?: string | null
          role?: 'owner' | 'admin' | 'mechanic'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          workshop_id?: string | null
          role?: 'owner' | 'admin' | 'mechanic'
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          email: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          customer_id: string
          plate: string
          vin: string | null
          make: string | null
          model: string | null
          year: number | null
          engine: string | null
          mileage_current: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          plate: string
          vin?: string | null
          make?: string | null
          model?: string | null
          year?: number | null
          engine?: string | null
          mileage_current?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          plate?: string
          vin?: string | null
          make?: string | null
          model?: string | null
          year?: number | null
          engine?: string | null
          mileage_current?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      service_visits: {
        Row: {
          id: string
          vehicle_id: string
          customer_id: string
          visit_date: string
          mileage: number | null
          intake_notes: string | null
          summary: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          customer_id: string
          visit_date?: string
          mileage?: number | null
          intake_notes?: string | null
          summary?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          customer_id?: string
          visit_date?: string
          mileage?: number | null
          intake_notes?: string | null
          summary?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      service_items: {
        Row: {
          id: string
          visit_id: string
          category: string
          title: string
          description: string | null
          parts_used_json: Json
          next_service_date: string | null
          next_service_mileage: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          category?: string
          title: string
          description?: string | null
          parts_used_json?: Json
          next_service_date?: string | null
          next_service_mileage?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          category?: string
          title?: string
          description?: string | null
          parts_used_json?: Json
          next_service_date?: string | null
          next_service_mileage?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      service_reminders: {
        Row: {
          id: string
          vehicle_id: string
          customer_id: string
          source_visit_id: string | null
          due_date: string | null
          due_mileage: number | null
          reason: string
          status: 'pending' | 'contacted' | 'done' | 'snoozed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          customer_id: string
          source_visit_id?: string | null
          due_date?: string | null
          due_mileage?: number | null
          reason: string
          status?: 'pending' | 'contacted' | 'done' | 'snoozed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          customer_id?: string
          source_visit_id?: string | null
          due_date?: string | null
          due_mileage?: number | null
          reason?: string
          status?: 'pending' | 'contacted' | 'done' | 'snoozed'
          created_at?: string
          updated_at?: string
        }
      }
      visit_notes: {
        Row: {
          id: string
          visit_id: string
          body: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          body: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          body?: string
          created_by?: string | null
          created_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          visit_id: string
          file_url: string
          file_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          file_url: string
          file_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          file_url?: string
          file_type?: string | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          action: string
          actor_id: string | null
          payload_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          action: string
          actor_id?: string | null
          payload_json?: Json
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          actor_id?: string | null
          payload_json?: Json
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Vehicle = Database['public']['Tables']['vehicles']['Row']
export type ServiceVisit = Database['public']['Tables']['service_visits']['Row']
export type ServiceItem = Database['public']['Tables']['service_items']['Row']
export type ServiceReminder = Database['public']['Tables']['service_reminders']['Row']
export type VisitNote = Database['public']['Tables']['visit_notes']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']
export type AuditLog = Database['public']['Tables']['audit_log']['Row']
