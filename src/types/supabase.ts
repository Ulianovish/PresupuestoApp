export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '12.2.3 (519615d)';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          type: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          type?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          type?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      budget_items: {
        Row: {
          budgeted_amount: number;
          category_id: string;
          classification_id: string;
          control_id: string;
          created_at: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          real_amount: number | null;
          spent_amount: number;
          status_id: string;
          template_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          budgeted_amount?: number;
          category_id: string;
          classification_id: string;
          control_id: string;
          created_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          real_amount?: number | null;
          spent_amount?: number;
          status_id: string;
          template_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          budgeted_amount?: number;
          category_id?: string;
          classification_id?: string;
          control_id?: string;
          created_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          real_amount?: number | null;
          spent_amount?: number;
          status_id?: string;
          template_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_items_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_items_classification_id_fkey';
            columns: ['classification_id'];
            isOneToOne: false;
            referencedRelation: 'classifications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_items_control_id_fkey';
            columns: ['control_id'];
            isOneToOne: false;
            referencedRelation: 'controls';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_items_status_id_fkey';
            columns: ['status_id'];
            isOneToOne: false;
            referencedRelation: 'budget_statuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_items_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'budget_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      budget_statuses: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
        };
        Relationships: [];
      };
      budget_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          month_year: string;
          name: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          month_year?: string;
          name: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          month_year?: string;
          name?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_templates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
        };
        Relationships: [];
      };
      classifications: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
        };
        Relationships: [];
      };
      controls: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          code: string;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          symbol: string;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          symbol: string;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          symbol?: string;
        };
        Relationships: [];
      };
      deudas: {
        Row: {
          acreedor: string;
          created_at: string | null;
          descripcion: string;
          es_activo: boolean | null;
          fecha_vencimiento: string;
          id: string;
          monto: number;
          pagada: boolean | null;
          tipo: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          acreedor: string;
          created_at?: string | null;
          descripcion: string;
          es_activo?: boolean | null;
          fecha_vencimiento: string;
          id?: string;
          monto?: number;
          pagada?: boolean | null;
          tipo?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          acreedor?: string;
          created_at?: string | null;
          descripcion?: string;
          es_activo?: boolean | null;
          fecha_vencimiento?: string;
          id?: string;
          monto?: number;
          pagada?: boolean | null;
          tipo?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'deudas_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      electronic_invoices: {
        Row: {
          created_at: string | null;
          cufe_code: string;
          extracted_data: Json | null;
          id: string;
          invoice_date: string | null;
          pdf_url: string | null;
          processed_at: string | null;
          supplier_name: string | null;
          supplier_nit: string | null;
          total_amount: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          cufe_code: string;
          extracted_data?: Json | null;
          id?: string;
          invoice_date?: string | null;
          pdf_url?: string | null;
          processed_at?: string | null;
          supplier_name?: string | null;
          supplier_nit?: string | null;
          total_amount?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          cufe_code?: string;
          extracted_data?: Json | null;
          id?: string;
          invoice_date?: string | null;
          pdf_url?: string | null;
          processed_at?: string | null;
          supplier_name?: string | null;
          supplier_nit?: string | null;
          total_amount?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ingresos: {
        Row: {
          created_at: string | null;
          descripcion: string;
          es_activo: boolean | null;
          fecha: string;
          fuente: string;
          id: string;
          monto: number;
          tipo: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          descripcion: string;
          es_activo?: boolean | null;
          fecha: string;
          fuente: string;
          id?: string;
          monto?: number;
          tipo?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          descripcion?: string;
          es_activo?: boolean | null;
          fecha?: string;
          fuente?: string;
          id?: string;
          monto?: number;
          tipo?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ingresos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      transaction_types: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          account_id: string | null;
          amount: number;
          budget_item_id: string | null;
          category_name: string | null;
          created_at: string | null;
          description: string | null;
          electronic_invoice_id: string | null;
          id: string;
          month_year: string;
          place: string | null;
          transaction_date: string;
          type_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          amount: number;
          budget_item_id?: string | null;
          category_name?: string | null;
          created_at?: string | null;
          description?: string | null;
          electronic_invoice_id?: string | null;
          id?: string;
          month_year: string;
          place?: string | null;
          transaction_date: string;
          type_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          budget_item_id?: string | null;
          category_name?: string | null;
          created_at?: string | null;
          description?: string | null;
          electronic_invoice_id?: string | null;
          id?: string;
          month_year?: string;
          place?: string | null;
          transaction_date?: string;
          type_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_budget_item_id_fkey';
            columns: ['budget_item_id'];
            isOneToOne: false;
            referencedRelation: 'budget_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_electronic_invoice_id_fkey';
            columns: ['electronic_invoice_id'];
            isOneToOne: false;
            referencedRelation: 'electronic_invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_type_id_fkey';
            columns: ['type_id'];
            isOneToOne: false;
            referencedRelation: 'transaction_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_cufe_exists: {
        Args: { p_cufe_code: string; p_user_id: string };
        Returns: boolean;
      };
      copy_budget_items_from_template: {
        Args: {
          p_source_template_id: string;
          p_target_template_id: string;
          p_user_id: string;
        };
        Returns: number;
      };
      fix_templates_without_items: {
        Args: { p_user_id: string };
        Returns: {
          items_copied: number;
          month_year: string;
          template_id: string;
        }[];
      };
      get_available_expense_months: {
        Args: { p_user_id: string };
        Returns: {
          month_year: string;
        }[];
      };
      get_balance_neto: {
        Args: { usuario_id: string };
        Returns: number;
      };
      get_budget_by_month: {
        Args: { p_month_year: string; p_user_id: string };
        Returns: {
          budgeted_amount: number;
          category_color: string;
          category_icon: string;
          category_id: string;
          category_name: string;
          classification_color: string;
          classification_name: string;
          control_color: string;
          control_name: string;
          due_date: string;
          item_description: string;
          item_id: string;
          item_name: string;
          real_amount: number;
          spent_amount: number;
          template_id: string;
          template_name: string;
        }[];
      };
      get_electronic_invoices_by_date_range: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string };
        Returns: {
          cufe_code: string;
          has_expenses: boolean;
          id: string;
          invoice_date: string;
          processed_at: string;
          supplier_name: string;
          supplier_nit: string;
          total_amount: number;
        }[];
      };
      get_expenses_by_month: {
        Args: { p_month_year: string; p_user_id: string };
        Returns: {
          account_name: string;
          amount: number;
          category_name: string;
          created_at: string;
          description: string;
          id: string;
          place: string;
          transaction_date: string;
        }[];
      };
      get_expenses_summary_by_month: {
        Args: { p_month_year: string; p_user_id: string };
        Returns: {
          category_name: string;
          total_amount: number;
          transaction_count: number;
        }[];
      };
      get_invoice_stats_by_supplier: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string };
        Returns: {
          avg_amount: number;
          invoice_count: number;
          last_invoice_date: string;
          supplier_name: string;
          supplier_nit: string;
          total_amount: number;
        }[];
      };
      get_total_deudas: {
        Args: { usuario_id: string };
        Returns: number;
      };
      get_total_ingresos: {
        Args: { usuario_id: string };
        Returns: number;
      };
      upsert_monthly_budget: {
        Args: {
          p_month_year: string;
          p_template_name?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      upsert_monthly_expense: {
        Args: {
          p_account_name: string;
          p_amount: number;
          p_category_name: string;
          p_description: string;
          p_month_year?: string;
          p_place?: string;
          p_transaction_date: string;
          p_user_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
