/**
 * Tipos de base de datos generados por Supabase
 * Este archivo se genera automáticamente con el comando:
 * npx supabase gen types typescript --project-id your-project-id --schema public > src/types/database.ts
 */

export interface Database {
  public: {
    Tables: {
      // Tablas de lookup (configuración)
      budget_statuses: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      classifications: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      controls: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      transaction_types: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      currencies: {
        Row: {
          id: string;
          name: string;
          code: string;
          symbol: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          symbol: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          symbol?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      // Tablas principales
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      budget_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      budget_items: {
        Row: {
          id: string;
          user_id: string;
          template_id: string | null;
          category_id: string;
          classification_id: string;
          control_id: string;
          status_id: string;
          name: string;
          description: string | null;
          budgeted_amount: number;
          spent_amount: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id?: string | null;
          category_id: string;
          classification_id: string;
          control_id: string;
          status_id: string;
          name: string;
          description?: string | null;
          budgeted_amount: number;
          spent_amount?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string | null;
          category_id?: string;
          classification_id?: string;
          control_id?: string;
          status_id?: string;
          name?: string;
          description?: string | null;
          budgeted_amount?: number;
          spent_amount?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          budget_item_id: string;
          type_id: string;
          amount: number;
          description: string | null;
          transaction_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          budget_item_id: string;
          type_id: string;
          amount: number;
          description?: string | null;
          transaction_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          budget_item_id?: string;
          type_id?: string;
          amount?: number;
          description?: string | null;
          transaction_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      electronic_invoices: {
        Row: {
          id: string;
          user_id: string;
          cufe_code: string;
          supplier_name: string | null;
          supplier_nit: string | null;
          invoice_date: string;
          total_amount: number;
          extracted_data: Record<string, unknown> | null;
          pdf_url: string | null;
          processed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cufe_code: string;
          supplier_name?: string | null;
          supplier_nit?: string | null;
          invoice_date: string;
          total_amount?: number;
          extracted_data?: Record<string, unknown> | null;
          pdf_url?: string | null;
          processed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cufe_code?: string;
          supplier_name?: string | null;
          supplier_nit?: string | null;
          invoice_date?: string;
          total_amount?: number;
          extracted_data?: Record<string, unknown> | null;
          pdf_url?: string | null;
          processed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
