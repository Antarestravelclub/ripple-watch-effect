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
      bridge_account_snapshots: {
        Row: {
          account_mode: string
          account_number: string
          balance: number | null
          created_at: string
          currency: string | null
          equity: number | null
          free_margin: number | null
          id: string
          margin: number | null
          received_at: string
        }
        Insert: {
          account_mode: string
          account_number: string
          balance?: number | null
          created_at?: string
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          margin?: number | null
          received_at?: string
        }
        Update: {
          account_mode?: string
          account_number?: string
          balance?: number | null
          created_at?: string
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          margin?: number | null
          received_at?: string
        }
        Relationships: []
      }
      bridge_deals: {
        Row: {
          close_price: number | null
          close_time: string | null
          commission: number | null
          created_at: string
          deal_id: number
          direction: string | null
          id: string
          lots: number | null
          open_price: number | null
          open_time: string | null
          profit: number | null
          swap: number | null
          symbol: string
          ticket: number | null
        }
        Insert: {
          close_price?: number | null
          close_time?: string | null
          commission?: number | null
          created_at?: string
          deal_id: number
          direction?: string | null
          id?: string
          lots?: number | null
          open_price?: number | null
          open_time?: string | null
          profit?: number | null
          swap?: number | null
          symbol: string
          ticket?: number | null
        }
        Update: {
          close_price?: number | null
          close_time?: string | null
          commission?: number | null
          created_at?: string
          deal_id?: number
          direction?: string | null
          id?: string
          lots?: number | null
          open_price?: number | null
          open_time?: string | null
          profit?: number | null
          swap?: number | null
          symbol?: string
          ticket?: number | null
        }
        Relationships: []
      }
      bridge_instructions: {
        Row: {
          action: string
          broker_symbol: string
          created_at: string
          direction: string
          expires_at: string
          fill_price: number | null
          fill_time: string | null
          filled_ticket: number | null
          id: string
          lots: number | null
          paper_trade_id: string | null
          picked_up_at: string | null
          sl: number | null
          status: string
          status_detail: string | null
          ticket: number | null
          tp: number | null
          updated_at: string
        }
        Insert: {
          action: string
          broker_symbol: string
          created_at?: string
          direction: string
          expires_at?: string
          fill_price?: number | null
          fill_time?: string | null
          filled_ticket?: number | null
          id?: string
          lots?: number | null
          paper_trade_id?: string | null
          picked_up_at?: string | null
          sl?: number | null
          status?: string
          status_detail?: string | null
          ticket?: number | null
          tp?: number | null
          updated_at?: string
        }
        Update: {
          action?: string
          broker_symbol?: string
          created_at?: string
          direction?: string
          expires_at?: string
          fill_price?: number | null
          fill_time?: string | null
          filled_ticket?: number | null
          id?: string
          lots?: number | null
          paper_trade_id?: string | null
          picked_up_at?: string | null
          sl?: number | null
          status?: string
          status_detail?: string | null
          ticket?: number | null
          tp?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bridge_instructions_paper_trade_id_fkey"
            columns: ["paper_trade_id"]
            isOneToOne: false
            referencedRelation: "paper_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_mirror_settings: {
        Row: {
          created_at: string
          id: string
          max_lots_per_trade: number
          mirroring_paused: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_lots_per_trade?: number
          mirroring_paused?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_lots_per_trade?: number
          mirroring_paused?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bridge_positions: {
        Row: {
          created_at: string
          current_price: number | null
          direction: string
          id: string
          last_seen_at: string
          lots: number | null
          open_price: number | null
          open_time: string | null
          profit: number | null
          sl: number | null
          status: string
          symbol: string
          ticket: number
          tp: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_price?: number | null
          direction: string
          id?: string
          last_seen_at?: string
          lots?: number | null
          open_price?: number | null
          open_time?: string | null
          profit?: number | null
          sl?: number | null
          status?: string
          symbol: string
          ticket: number
          tp?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_price?: number | null
          direction?: string
          id?: string
          last_seen_at?: string
          lots?: number | null
          open_price?: number | null
          open_time?: string | null
          profit?: number | null
          sl?: number | null
          status?: string
          symbol?: string
          ticket?: number
          tp?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      broker_bridge_heartbeats: {
        Row: {
          account_is_demo: boolean | null
          account_login: string | null
          account_server: string | null
          balance: number | null
          bridge_version: string | null
          currency: string | null
          equity: number | null
          id: string
          note: string | null
          open_positions: number | null
          seen_at: string
        }
        Insert: {
          account_is_demo?: boolean | null
          account_login?: string | null
          account_server?: string | null
          balance?: number | null
          bridge_version?: string | null
          currency?: string | null
          equity?: number | null
          id?: string
          note?: string | null
          open_positions?: number | null
          seen_at?: string
        }
        Update: {
          account_is_demo?: boolean | null
          account_login?: string | null
          account_server?: string | null
          balance?: number | null
          bridge_version?: string | null
          currency?: string | null
          equity?: number | null
          id?: string
          note?: string | null
          open_positions?: number | null
          seen_at?: string
        }
        Relationships: []
      }
      broker_orders: {
        Row: {
          broker_symbol: string | null
          broker_ticket: string | null
          claimed_at: string | null
          conviction_score: number | null
          created_at: string
          error: string | null
          filled_at: string | null
          filled_price: number | null
          filled_volume: number | null
          id: string
          intent: string
          mode: string
          reference_price: number | null
          side: string
          signal_id: string
          status: string
          stop_price: number | null
          suggested_size_pct: number | null
          target_price: number | null
          ticker: string
          updated_at: string
        }
        Insert: {
          broker_symbol?: string | null
          broker_ticket?: string | null
          claimed_at?: string | null
          conviction_score?: number | null
          created_at?: string
          error?: string | null
          filled_at?: string | null
          filled_price?: number | null
          filled_volume?: number | null
          id?: string
          intent?: string
          mode?: string
          reference_price?: number | null
          side: string
          signal_id: string
          status?: string
          stop_price?: number | null
          suggested_size_pct?: number | null
          target_price?: number | null
          ticker: string
          updated_at?: string
        }
        Update: {
          broker_symbol?: string | null
          broker_ticket?: string | null
          claimed_at?: string | null
          conviction_score?: number | null
          created_at?: string
          error?: string | null
          filled_at?: string | null
          filled_price?: number | null
          filled_volume?: number | null
          id?: string
          intent?: string
          mode?: string
          reference_price?: number | null
          side?: string
          signal_id?: string
          status?: string
          stop_price?: number | null
          suggested_size_pct?: number | null
          target_price?: number | null
          ticker?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_orders_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_symbol_uploads: {
        Row: {
          created_at: string
          created_by: string | null
          filename: string | null
          id: string
          mapped_count: number
          source: string | null
          symbol_count: number
          unmapped_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          mapped_count?: number
          source?: string | null
          symbol_count?: number
          unmapped_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          mapped_count?: number
          source?: string | null
          symbol_count?: number
          unmapped_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      broker_symbols: {
        Row: {
          broker_symbol: string
          created_at: string
          currency_profit: string | null
          description: string | null
          id: string
          mapped_app_ticker: string | null
          mapping_status: string
          normalized_base: string | null
          path: string | null
          review_reason: string | null
          trade_mode: string | null
          updated_at: string
          upload_id: string
        }
        Insert: {
          broker_symbol: string
          created_at?: string
          currency_profit?: string | null
          description?: string | null
          id?: string
          mapped_app_ticker?: string | null
          mapping_status?: string
          normalized_base?: string | null
          path?: string | null
          review_reason?: string | null
          trade_mode?: string | null
          updated_at?: string
          upload_id: string
        }
        Update: {
          broker_symbol?: string
          created_at?: string
          currency_profit?: string | null
          description?: string | null
          id?: string
          mapped_app_ticker?: string | null
          mapping_status?: string
          normalized_base?: string | null
          path?: string | null
          review_reason?: string | null
          trade_mode?: string | null
          updated_at?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_symbols_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "broker_symbol_uploads"
            referencedColumns: ["id"]
          },
        ]
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
      latest_prices: {
        Row: {
          created_at: string
          day_high: number | null
          day_low: number | null
          fetch_time: string
          prev_close: number | null
          price: number
          quote_time: string | null
          source: string
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_high?: number | null
          day_low?: number | null
          fetch_time?: string
          prev_close?: number | null
          price: number
          quote_time?: string | null
          source?: string
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_high?: number | null
          day_low?: number | null
          fetch_time?: string
          prev_close?: number | null
          price?: number
          quote_time?: string | null
          source?: string
          symbol?: string
          updated_at?: string
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
      paper_trades: {
        Row: {
          both_touched: boolean
          created_at: string
          demo_close_price: number | null
          demo_fill_price: number | null
          demo_realized_pnl: number | null
          direction: string
          entry_price: number
          entry_time: string
          exit_price: number | null
          exit_reason: string | null
          exit_time: string | null
          id: string
          mirror_ticket: number | null
          mirrored: boolean
          notes: string | null
          overrides_used: boolean
          position_size: number
          quote_symbol: string | null
          realized_pnl: number | null
          signal_id: string | null
          source: string
          status: string
          stop_price: number
          target_price: number
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          both_touched?: boolean
          created_at?: string
          demo_close_price?: number | null
          demo_fill_price?: number | null
          demo_realized_pnl?: number | null
          direction: string
          entry_price: number
          entry_time?: string
          exit_price?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          id?: string
          mirror_ticket?: number | null
          mirrored?: boolean
          notes?: string | null
          overrides_used?: boolean
          position_size: number
          quote_symbol?: string | null
          realized_pnl?: number | null
          signal_id?: string | null
          source?: string
          status?: string
          stop_price: number
          target_price: number
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          both_touched?: boolean
          created_at?: string
          demo_close_price?: number | null
          demo_fill_price?: number | null
          demo_realized_pnl?: number | null
          direction?: string
          entry_price?: number
          entry_time?: string
          exit_price?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          id?: string
          mirror_ticket?: number | null
          mirrored?: boolean
          notes?: string | null
          overrides_used?: boolean
          position_size?: number
          quote_symbol?: string | null
          realized_pnl?: number | null
          signal_id?: string | null
          source?: string
          status?: string
          stop_price?: number
          target_price?: number
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
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
      price_fetch_runs: {
        Row: {
          created_at: string
          error: string | null
          failed: number
          finished_at: string
          id: string
          ok: boolean
          rate_limited: number
          requests_made: number
          source: string
          succeeded: number
          symbols_requested: number
        }
        Insert: {
          created_at?: string
          error?: string | null
          failed?: number
          finished_at?: string
          id?: string
          ok?: boolean
          rate_limited?: number
          requests_made?: number
          source?: string
          succeeded?: number
          symbols_requested?: number
        }
        Update: {
          created_at?: string
          error?: string | null
          failed?: number
          finished_at?: string
          id?: string
          ok?: boolean
          rate_limited?: number
          requests_made?: number
          source?: string
          succeeded?: number
          symbols_requested?: number
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
          benchmark_source: string
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
          benchmark_source?: string
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
          benchmark_source?: string
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
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
