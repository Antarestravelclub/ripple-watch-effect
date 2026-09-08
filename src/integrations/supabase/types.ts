export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      archetype_playbooks: {
        Row: {
          archetype: Database["public"]["Enums"]["event_archetype"]
          channel: string
          confidence: number
          created_at: string
          id: string
          typical_duration: string | null
          typical_losers: string[]
          typical_magnitude_range: string | null
          typical_winners: string[]
        }
        Insert: {
          archetype: Database["public"]["Enums"]["event_archetype"]
          channel: string
          confidence?: number
          created_at?: string
          id?: string
          typical_duration?: string | null
          typical_losers?: string[]
          typical_magnitude_range?: string | null
          typical_winners?: string[]
        }
        Update: {
          archetype?: Database["public"]["Enums"]["event_archetype"]
          channel?: string
          confidence?: number
          created_at?: string
          id?: string
          typical_duration?: string | null
          typical_losers?: string[]
          typical_magnitude_range?: string | null
          typical_winners?: string[]
        }
        Relationships: []
      }
      evaluation_runs: {
        Row: {
          created_at: string
          error: string | null
          evaluated: number
          expired: number
          finished_at: string
          id: string
          invalidated: number
          ok: boolean
          priced: number
          relevelled: number
          target_hits: number
        }
        Insert: {
          created_at?: string
          error?: string | null
          evaluated?: number
          expired?: number
          finished_at?: string
          id?: string
          invalidated?: number
          ok?: boolean
          priced?: number
          relevelled?: number
          target_hits?: number
        }
        Update: {
          created_at?: string
          error?: string | null
          evaluated?: number
          expired?: number
          finished_at?: string
          id?: string
          invalidated?: number
          ok?: boolean
          priced?: number
          relevelled?: number
          target_hits?: number
        }
        Relationships: []
      }
      historical_events: {
        Row: {
          archetype: Database["public"]["Enums"]["event_archetype"]
          country: string | null
          created_at: string
          event_date: string
          id: string
          region: string | null
          source_url: string | null
          summary: string
          title: string
          transmission_channel: string
        }
        Insert: {
          archetype: Database["public"]["Enums"]["event_archetype"]
          country?: string | null
          created_at?: string
          event_date: string
          id?: string
          region?: string | null
          source_url?: string | null
          summary: string
          title: string
          transmission_channel: string
        }
        Update: {
          archetype?: Database["public"]["Enums"]["event_archetype"]
          country?: string | null
          created_at?: string
          event_date?: string
          id?: string
          region?: string | null
          source_url?: string | null
          summary?: string
          title?: string
          transmission_channel?: string
        }
        Relationships: []
      }
      historical_reactions: {
        Row: {
          company_name: string | null
          created_at: string
          days_to_revert: number | null
          direction: Database["public"]["Enums"]["reaction_direction"]
          exchange: string | null
          historical_event_id: string
          id: string
          notes: string | null
          pct_move: number
          peak_pct_move: number | null
          reverted: boolean
          role: Database["public"]["Enums"]["reaction_role"]
          sector: string | null
          ticker: string
          window_days: number
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          days_to_revert?: number | null
          direction: Database["public"]["Enums"]["reaction_direction"]
          exchange?: string | null
          historical_event_id: string
          id?: string
          notes?: string | null
          pct_move: number
          peak_pct_move?: number | null
          reverted?: boolean
          role: Database["public"]["Enums"]["reaction_role"]
          sector?: string | null
          ticker: string
          window_days: number
        }
        Update: {
          company_name?: string | null
          created_at?: string
          days_to_revert?: number | null
          direction?: Database["public"]["Enums"]["reaction_direction"]
          exchange?: string | null
          historical_event_id?: string
          id?: string
          notes?: string | null
          pct_move?: number
          peak_pct_move?: number | null
          reverted?: boolean
          role?: Database["public"]["Enums"]["reaction_role"]
          sector?: string | null
          ticker?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "historical_reactions_historical_event_id_fkey"
            columns: ["historical_event_id"]
            isOneToOne: false
            referencedRelation: "historical_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_runs: {
        Row: {
          error: string | null
          events_created: number
          finished_at: string | null
          headlines_seen: number
          id: string
          ok: boolean
          signals_created: number
          skipped: number
          stages: Json
          started_at: string
        }
        Insert: {
          error?: string | null
          events_created?: number
          finished_at?: string | null
          headlines_seen?: number
          id?: string
          ok?: boolean
          signals_created?: number
          skipped?: number
          stages?: Json
          started_at?: string
        }
        Update: {
          error?: string | null
          events_created?: number
          finished_at?: string | null
          headlines_seen?: number
          id?: string
          ok?: boolean
          signals_created?: number
          skipped?: number
          stages?: Json
          started_at?: string
        }
        Relationships: []
      }
      live_event_exposures: {
        Row: {
          company_name: string | null
          confidence: string
          created_at: string
          id: string
          live_event_id: string
          mechanism: string
          needs_review: boolean
          quote_symbol: string | null
          review_reason: string | null
          sector: string
          side: string
          ticker: string
        }
        Insert: {
          company_name?: string | null
          confidence?: string
          created_at?: string
          id?: string
          live_event_id: string
          mechanism?: string
          needs_review?: boolean
          quote_symbol?: string | null
          review_reason?: string | null
          sector?: string
          side: string
          ticker: string
        }
        Update: {
          company_name?: string | null
          confidence?: string
          created_at?: string
          id?: string
          live_event_id?: string
          mechanism?: string
          needs_review?: boolean
          quote_symbol?: string | null
          review_reason?: string | null
          sector?: string
          side?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_event_exposures_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          archived: boolean
          category: string
          created_at: string
          dedupe_key: string
          headline: string
          id: string
          published_at: string
          regions: string[]
          source: string
          source_url: string | null
          strength: string
          summary: string
          transmission_channel: string
          updated_at: string
          why_markets_care: string
        }
        Insert: {
          archived?: boolean
          category?: string
          created_at?: string
          dedupe_key: string
          headline: string
          id?: string
          published_at?: string
          regions?: string[]
          source?: string
          source_url?: string | null
          strength?: string
          summary?: string
          transmission_channel?: string
          updated_at?: string
          why_markets_care?: string
        }
        Update: {
          archived?: boolean
          category?: string
          created_at?: string
          dedupe_key?: string
          headline?: string
          id?: string
          published_at?: string
          regions?: string[]
          source?: string
          source_url?: string | null
          strength?: string
          summary?: string
          transmission_channel?: string
          updated_at?: string
          why_markets_care?: string
        }
        Relationships: []
      }
      portfolio_settings: {
        Row: {
          created_at: string
          id: string
          max_position_pct: number
          notional_value: number
          risk_per_trade_pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_position_pct?: number
          notional_value?: number
          risk_per_trade_pct?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_position_pct?: number
          notional_value?: number
          risk_per_trade_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      price_snapshots: {
        Row: {
          captured_at: string
          day_high: number | null
          day_low: number | null
          id: number
          price: number
          signal_id: string
          ticker: string
        }
        Insert: {
          captured_at?: string
          day_high?: number | null
          day_low?: number | null
          id?: number
          price: number
          signal_id: string
          ticker: string
        }
        Update: {
          captured_at?: string
          day_high?: number | null
          day_low?: number | null
          id?: number
          price?: number
          signal_id?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_evaluation_log: {
        Row: {
          benchmark_price: number | null
          created_at: string
          detail: string | null
          id: number
          price: number | null
          signal_id: string
          trigger: string
        }
        Insert: {
          benchmark_price?: number | null
          created_at?: string
          detail?: string | null
          id?: number
          price?: number | null
          signal_id: string
          trigger: string
        }
        Update: {
          benchmark_price?: number | null
          created_at?: string
          detail?: string | null
          id?: number
          price?: number | null
          signal_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_evaluation_log_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          atr_at_signal: number | null
          below_threshold: boolean
          benchmark_entry_estimated: boolean
          benchmark_entry_price: number | null
          benchmark_exit_price: number | null
          benchmark_symbol: string
          close_reason: string | null
          closed_at: string | null
          closed_price: number | null
          company_name: string | null
          conviction: number
          conviction_breakdown: Json | null
          conviction_score: number | null
          created_at: string
          direction: string
          event_id: string
          exchange: string | null
          generated_by: string
          id: string
          invalidation_params: Json | null
          invalidation_price: number | null
          invalidation_text: string | null
          mode: string
          needs_review: boolean
          price_error: string | null
          price_status: string
          quote_symbol: string | null
          rationale: string | null
          signal_price: number | null
          signal_timestamp: string
          status: string
          stop_price: number | null
          suggested_size_pct: number | null
          target_price: number | null
          ticker: string
        }
        Insert: {
          atr_at_signal?: number | null
          below_threshold?: boolean
          benchmark_entry_estimated?: boolean
          benchmark_entry_price?: number | null
          benchmark_exit_price?: number | null
          benchmark_symbol?: string
          close_reason?: string | null
          closed_at?: string | null
          closed_price?: number | null
          company_name?: string | null
          conviction?: number
          conviction_breakdown?: Json | null
          conviction_score?: number | null
          created_at?: string
          direction: string
          event_id: string
          exchange?: string | null
          generated_by?: string
          id?: string
          invalidation_params?: Json | null
          invalidation_price?: number | null
          invalidation_text?: string | null
          mode?: string
          needs_review?: boolean
          price_error?: string | null
          price_status?: string
          quote_symbol?: string | null
          rationale?: string | null
          signal_price?: number | null
          signal_timestamp?: string
          status?: string
          stop_price?: number | null
          suggested_size_pct?: number | null
          target_price?: number | null
          ticker: string
        }
        Update: {
          atr_at_signal?: number | null
          below_threshold?: boolean
          benchmark_entry_estimated?: boolean
          benchmark_entry_price?: number | null
          benchmark_exit_price?: number | null
          benchmark_symbol?: string
          close_reason?: string | null
          closed_at?: string | null
          closed_price?: number | null
          company_name?: string | null
          conviction?: number
          conviction_breakdown?: Json | null
          conviction_score?: number | null
          created_at?: string
          direction?: string
          event_id?: string
          exchange?: string | null
          generated_by?: string
          id?: string
          invalidation_params?: Json | null
          invalidation_price?: number | null
          invalidation_text?: string | null
          mode?: string
          needs_review?: boolean
          price_error?: string | null
          price_status?: string
          quote_symbol?: string | null
          rationale?: string | null
          signal_price?: number | null
          signal_timestamp?: string
          status?: string
          stop_price?: number | null
          suggested_size_pct?: number | null
          target_price?: number | null
          ticker?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_archetype:
        | "armed_conflict"
        | "terror_attack"
        | "natural_disaster"
        | "industrial_accident"
        | "regulatory_action"
        | "supply_chain_disruption"
        | "political_instability"
        | "pandemic_health"
        | "cyber_attack"
        | "commodity_shock"
      reaction_direction: "up" | "down"
      reaction_role:
        | "direct_loser"
        | "direct_winner"
        | "substitute_winner"
        | "second_order_winner"
        | "second_order_loser"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_archetype: [
        "armed_conflict",
        "terror_attack",
        "natural_disaster",
        "industrial_accident",
        "regulatory_action",
        "supply_chain_disruption",
        "political_instability",
        "pandemic_health",
        "cyber_attack",
        "commodity_shock",
      ],
      reaction_direction: ["up", "down"],
      reaction_role: [
        "direct_loser",
        "direct_winner",
        "substitute_winner",
        "second_order_winner",
        "second_order_loser",
      ],
    },
  },
} as const
