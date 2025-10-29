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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accountability_nodes: {
        Row: {
          api_endpoint: string | null
          api_key: string | null
          contact_email: string | null
          country: string
          created_at: string | null
          id: string
          joined_at: string | null
          jurisdiction: string
          last_active_at: string | null
          metadata: Json | null
          org_name: string
          org_type: Database["public"]["Enums"]["org_type"]
          pgp_public_key: string | null
          rate_limit_per_hour: number | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key?: string | null
          contact_email?: string | null
          country: string
          created_at?: string | null
          id?: string
          joined_at?: string | null
          jurisdiction: string
          last_active_at?: string | null
          metadata?: Json | null
          org_name: string
          org_type: Database["public"]["Enums"]["org_type"]
          pgp_public_key?: string | null
          rate_limit_per_hour?: number | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          api_endpoint?: string | null
          api_key?: string | null
          contact_email?: string | null
          country?: string
          created_at?: string | null
          id?: string
          joined_at?: string | null
          jurisdiction?: string
          last_active_at?: string | null
          metadata?: Json | null
          org_name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          pgp_public_key?: string | null
          rate_limit_per_hour?: number | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string | null
          session_id: string | null
          tokens_est: number | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role?: string | null
          session_id?: string | null
          tokens_est?: number | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string | null
          session_id?: string | null
          tokens_est?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          id: string
          last_active_at: string | null
          started_at: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          last_active_at?: string | null
          started_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          last_active_at?: string | null
          started_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_decision_logs: {
        Row: {
          bias_score: number | null
          confidence: number | null
          created_at: string | null
          division_key: string
          ethical_flags: string[] | null
          explanation: Json | null
          id: string
          input_summary: string
          model_name: string
          output_summary: string
          reviewer_id: string | null
        }
        Insert: {
          bias_score?: number | null
          confidence?: number | null
          created_at?: string | null
          division_key: string
          ethical_flags?: string[] | null
          explanation?: Json | null
          id?: string
          input_summary: string
          model_name: string
          output_summary: string
          reviewer_id?: string | null
        }
        Update: {
          bias_score?: number | null
          confidence?: number | null
          created_at?: string | null
          division_key?: string
          ethical_flags?: string[] | null
          explanation?: Json | null
          id?: string
          input_summary?: string
          model_name?: string
          output_summary?: string
          reviewer_id?: string | null
        }
        Relationships: []
      }
      ai_divisions: {
        Row: {
          created_at: string
          division_key: string
          id: string
          last_check: string
          name: string
          performance_score: number
          status: Database["public"]["Enums"]["division_status"]
          updated_at: string
          uptime_percentage: number
        }
        Insert: {
          created_at?: string
          division_key: string
          id?: string
          last_check?: string
          name: string
          performance_score?: number
          status?: Database["public"]["Enums"]["division_status"]
          updated_at?: string
          uptime_percentage?: number
        }
        Update: {
          created_at?: string
          division_key?: string
          id?: string
          last_check?: string
          name?: string
          performance_score?: number
          status?: Database["public"]["Enums"]["division_status"]
          updated_at?: string
          uptime_percentage?: number
        }
        Relationships: []
      }
      ai_learning_log: {
        Row: {
          created_at: string | null
          id: string
          insight: string | null
          record_id: string | null
          source_table: string | null
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          insight?: string | null
          record_id?: string | null
          source_table?: string | null
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          insight?: string | null
          record_id?: string | null
          source_table?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      ai_mitigation_actions: {
        Row: {
          action_type: string
          created_at: string | null
          crisis_id: string | null
          executed_at: string | null
          id: string
          parameters: Json | null
          status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          crisis_id?: string | null
          executed_at?: string | null
          id?: string
          parameters?: Json | null
          status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          crisis_id?: string | null
          executed_at?: string | null
          id?: string
          parameters?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_mitigation_actions_crisis_id_fkey"
            columns: ["crisis_id"]
            isOneToOne: false
            referencedRelation: "crisis_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          content: string
          created_at: string
          division: string
          id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          division: string
          id?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          division?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      anomaly_detections: {
        Row: {
          anomaly_type: string
          baseline_metrics: Json | null
          created_at: string | null
          description: string
          detected_at: string | null
          deviation_percentage: number | null
          division: string
          id: string
          metrics: Json
          notes: string | null
          resolved_at: string | null
          severity: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          anomaly_type: string
          baseline_metrics?: Json | null
          created_at?: string | null
          description: string
          detected_at?: string | null
          deviation_percentage?: number | null
          division: string
          id?: string
          metrics: Json
          notes?: string | null
          resolved_at?: string | null
          severity: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          anomaly_type?: string
          baseline_metrics?: Json | null
          created_at?: string | null
          description?: string
          detected_at?: string | null
          deviation_percentage?: number | null
          division?: string
          id?: string
          metrics?: Json
          notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          rate_limit_per_minute: number | null
          revoked: boolean | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          rate_limit_per_minute?: number | null
          revoked?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          rate_limit_per_minute?: number | null
          revoked?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          action: string
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          division: string
          id: string
          payload: Json | null
          requester: string | null
          status: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          division: string
          id?: string
          payload?: Json | null
          requester?: string | null
          status?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          division?: string
          id?: string
          payload?: Json | null
          requester?: string | null
          status?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          org_id: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          org_id?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          org_id?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          executed_at: string | null
          id: string
          job_name: string
          message: string | null
          status: string
        }
        Insert: {
          executed_at?: string | null
          id?: string
          job_name: string
          message?: string | null
          status: string
        }
        Update: {
          executed_at?: string | null
          id?: string
          job_name?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          org_id: string | null
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          org_id?: string | null
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          org_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_usage_queue: {
        Row: {
          id: string
          metric_key: string
          org_id: string | null
          processed: boolean | null
          quantity: number
          recorded_at: string | null
        }
        Insert: {
          id?: string
          metric_key: string
          org_id?: string | null
          processed?: boolean | null
          quantity: number
          recorded_at?: string | null
        }
        Update: {
          id?: string
          metric_key?: string
          org_id?: string | null
          processed?: boolean | null
          quantity?: number
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_usage_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          accent_color: string | null
          created_at: string | null
          custom_css: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          metadata: Json | null
          org_id: string
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          org_id: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          org_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      command_history: {
        Row: {
          command: string
          created_at: string
          execution_time_ms: number | null
          id: string
          response: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          command: string
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          response?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          command?: string
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          response?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      compliance_audit: {
        Row: {
          action_description: string
          action_type: string
          compliance_status: string
          created_at: string | null
          data_accessed: Json | null
          division: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          compliance_status: string
          created_at?: string | null
          data_accessed?: Json | null
          division?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          compliance_status?: string
          created_at?: string | null
          data_accessed?: Json | null
          division?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crisis_events: {
        Row: {
          created_at: string | null
          details_md: string | null
          id: string
          kind: string
          opened_at: string | null
          region: string
          resolved_at: string | null
          severity: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          details_md?: string | null
          id?: string
          kind: string
          opened_at?: string | null
          region: string
          resolved_at?: string | null
          severity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          details_md?: string | null
          id?: string
          kind?: string
          opened_at?: string | null
          region?: string
          resolved_at?: string | null
          severity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_domains: {
        Row: {
          created_at: string | null
          dns_configured: boolean | null
          domain: string
          error_message: string | null
          id: string
          last_check_at: string | null
          org_id: string
          ssl_enabled: boolean | null
          status: string | null
          updated_at: string | null
          verification_token: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          dns_configured?: boolean | null
          domain: string
          error_message?: string | null
          id?: string
          last_check_at?: string | null
          org_id: string
          ssl_enabled?: boolean | null
          status?: string | null
          updated_at?: string | null
          verification_token: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          dns_configured?: boolean | null
          domain?: string
          error_message?: string | null
          id?: string
          last_check_at?: string | null
          org_id?: string
          ssl_enabled?: boolean | null
          status?: string | null
          updated_at?: string | null
          verification_token?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_control: {
        Row: {
          access_tier: Database["public"]["Enums"]["access_tier"]
          approved_purposes:
            | Database["public"]["Enums"]["data_purpose"][]
            | null
          created_at: string | null
          expires_at: string | null
          id: string
          jurisdiction: string | null
          node_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_tier?: Database["public"]["Enums"]["access_tier"]
          approved_purposes?:
            | Database["public"]["Enums"]["data_purpose"][]
            | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          jurisdiction?: string | null
          node_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_tier?: Database["public"]["Enums"]["access_tier"]
          approved_purposes?:
            | Database["public"]["Enums"]["data_purpose"][]
            | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          jurisdiction?: string | null
          node_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_control_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "accountability_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      data_collection_triggers: {
        Row: {
          condition_config: Json
          condition_type: string
          created_at: string | null
          enabled: boolean | null
          id: string
          last_triggered: string | null
          priority: string | null
          target_endpoint: string
          target_source: string
          trigger_count: number | null
          trigger_name: string
          updated_at: string | null
        }
        Insert: {
          condition_config: Json
          condition_type: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered?: string | null
          priority?: string | null
          target_endpoint: string
          target_source: string
          trigger_count?: number | null
          trigger_name: string
          updated_at?: string | null
        }
        Update: {
          condition_config?: Json
          condition_type?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered?: string | null
          priority?: string | null
          target_endpoint?: string
          target_source?: string
          trigger_count?: number | null
          trigger_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          id: string
          reason: string | null
          rejection_reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          error_message: string | null
          expires_at: string | null
          export_url: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_url?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_url?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          auto_delete: boolean | null
          category: string
          created_at: string | null
          id: string
          max_days: number
          updated_at: string | null
        }
        Insert: {
          auto_delete?: boolean | null
          category: string
          created_at?: string | null
          id?: string
          max_days: number
          updated_at?: string | null
        }
        Update: {
          auto_delete?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          max_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      data_sharing_agreements: {
        Row: {
          agreement_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          node_id: string | null
          sdg_tags: string[] | null
          signature: string
          signed_contract: Json
          status: string | null
        }
        Insert: {
          agreement_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          node_id?: string | null
          sdg_tags?: string[] | null
          signature: string
          signed_contract: Json
          status?: string | null
        }
        Update: {
          agreement_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          node_id?: string | null
          sdg_tags?: string[] | null
          signature?: string
          signed_contract?: Json
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_sharing_agreements_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "accountability_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      data_source_log: {
        Row: {
          created_at: string | null
          division: string
          error_message: string | null
          id: number
          last_success: string | null
          latency_ms: number | null
          records_ingested: number
          source: string
          status: string
        }
        Insert: {
          created_at?: string | null
          division: string
          error_message?: string | null
          id?: never
          last_success?: string | null
          latency_ms?: number | null
          records_ingested?: number
          source: string
          status: string
        }
        Update: {
          created_at?: string | null
          division?: string
          error_message?: string | null
          id?: never
          last_success?: string | null
          latency_ms?: number | null
          records_ingested?: number
          source?: string
          status?: string
        }
        Relationships: []
      }
      data_use_agreements: {
        Row: {
          agreement_text: string
          created_at: string | null
          data_categories: string[] | null
          effective_from: string
          expires_at: string | null
          id: string
          jurisdiction: string
          node_id: string | null
          purposes: Database["public"]["Enums"]["data_purpose"][] | null
          signature: string
          signed_by: string | null
          status: string | null
        }
        Insert: {
          agreement_text: string
          created_at?: string | null
          data_categories?: string[] | null
          effective_from: string
          expires_at?: string | null
          id?: string
          jurisdiction: string
          node_id?: string | null
          purposes?: Database["public"]["Enums"]["data_purpose"][] | null
          signature: string
          signed_by?: string | null
          status?: string | null
        }
        Update: {
          agreement_text?: string
          created_at?: string | null
          data_categories?: string[] | null
          effective_from?: string
          expires_at?: string | null
          id?: string
          jurisdiction?: string
          node_id?: string | null
          purposes?: Database["public"]["Enums"]["data_purpose"][] | null
          signature?: string
          signed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_use_agreements_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "accountability_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      defense_posture: {
        Row: {
          advisories_md: string | null
          created_at: string | null
          id: string
          region: string
          threat_level: number | null
          updated_at: string | null
        }
        Insert: {
          advisories_md?: string | null
          created_at?: string | null
          id?: string
          region: string
          threat_level?: number | null
          updated_at?: string | null
        }
        Update: {
          advisories_md?: string | null
          created_at?: string | null
          id?: string
          region?: string
          threat_level?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      diplo_signals: {
        Row: {
          country: string
          created_at: string | null
          id: string
          risk_index: number | null
          sentiment: number | null
          summary_md: string | null
          updated_at: string | null
        }
        Insert: {
          country: string
          created_at?: string | null
          id?: string
          risk_index?: number | null
          sentiment?: number | null
          summary_md?: string | null
          updated_at?: string | null
        }
        Update: {
          country?: string
          created_at?: string | null
          id?: string
          risk_index?: number | null
          sentiment?: number | null
          summary_md?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      division_impact_metrics: {
        Row: {
          captured_at: string | null
          division: string
          id: string
          impact_per_sc: number | null
          impact_score: number | null
          metric: Json
          rebalance_run_id: string | null
          sc_spent: number
        }
        Insert: {
          captured_at?: string | null
          division: string
          id?: string
          impact_per_sc?: number | null
          impact_score?: number | null
          metric: Json
          rebalance_run_id?: string | null
          sc_spent?: number
        }
        Update: {
          captured_at?: string | null
          division?: string
          id?: string
          impact_per_sc?: number | null
          impact_score?: number | null
          metric?: Json
          rebalance_run_id?: string | null
          sc_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "division_impact_metrics_rebalance_run_id_fkey"
            columns: ["rebalance_run_id"]
            isOneToOne: false
            referencedRelation: "sc_rebalance_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      division_kpis: {
        Row: {
          captured_at: string | null
          composite_score: number | null
          division: string
          id: string
          metric: Json
          risk_score: number | null
        }
        Insert: {
          captured_at?: string | null
          composite_score?: number | null
          division: string
          id?: string
          metric: Json
          risk_score?: number | null
        }
        Update: {
          captured_at?: string | null
          composite_score?: number | null
          division?: string
          id?: string
          metric?: Json
          risk_score?: number | null
        }
        Relationships: []
      }
      division_learning_weights: {
        Row: {
          division: string
          id: string
          impact_weight: number | null
          last_updated: string | null
          trend: number | null
        }
        Insert: {
          division: string
          id?: string
          impact_weight?: number | null
          last_updated?: string | null
          trend?: number | null
        }
        Update: {
          division?: string
          id?: string
          impact_weight?: number | null
          last_updated?: string | null
          trend?: number | null
        }
        Relationships: []
      }
      dpia_logs: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          assessment_type: string
          created_at: string | null
          data_categories: string[] | null
          id: string
          mitigation_measures: Json | null
          model_name: string | null
          risk_level: string
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_type: string
          created_at?: string | null
          data_categories?: string[] | null
          id?: string
          mitigation_measures?: Json | null
          model_name?: string | null
          risk_level: string
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_type?: string
          created_at?: string | null
          data_categories?: string[] | null
          id?: string
          mitigation_measures?: Json | null
          model_name?: string | null
          risk_level?: string
        }
        Relationships: []
      }
      economic_indicators: {
        Row: {
          country: string
          created_at: string | null
          date: string
          id: string
          indicator_name: string
          metadata: Json | null
          source: string | null
          unit: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          country: string
          created_at?: string | null
          date: string
          id?: string
          indicator_name: string
          metadata?: Json | null
          source?: string | null
          unit?: string | null
          updated_at?: string | null
          value: number
        }
        Update: {
          country?: string
          created_at?: string | null
          date?: string
          id?: string
          indicator_name?: string
          metadata?: Json | null
          source?: string | null
          unit?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      energy_grid: {
        Row: {
          capacity: number
          created_at: string
          grid_load: number
          id: string
          outage_risk: Database["public"]["Enums"]["stability_status"]
          region: string
          renewable_percentage: number | null
          stability_index: number
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          grid_load: number
          id?: string
          outage_risk?: Database["public"]["Enums"]["stability_status"]
          region: string
          renewable_percentage?: number | null
          stability_index: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          grid_load?: number
          id?: string
          outage_risk?: Database["public"]["Enums"]["stability_status"]
          region?: string
          renewable_percentage?: number | null
          stability_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      ethics_cases: {
        Row: {
          created_at: string | null
          decision_id: string | null
          id: string
          reason: string
          resolved_at: string | null
          reviewer_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          reason: string
          resolved_at?: string | null
          reviewer_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          reason?: string
          resolved_at?: string | null
          reviewer_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ethics_cases_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decision_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_reviewers: {
        Row: {
          cert_level: string
          created_at: string | null
          id: string
          jurisdiction: string
          user_id: string
        }
        Insert: {
          cert_level: string
          created_at?: string | null
          id?: string
          jurisdiction: string
          user_id: string
        }
        Update: {
          cert_level?: string
          created_at?: string | null
          id?: string
          jurisdiction?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_accounts: {
        Row: {
          balance_usd: number
          connected_at: string
          exchange: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          balance_usd?: number
          connected_at?: string
          exchange: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          balance_usd?: number
          connected_at?: string
          exchange?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      federation_inbound_signals: {
        Row: {
          id: string
          peer_id: string | null
          peer_trust: number | null
          received_at: string | null
          signals: Json
          signature_valid: boolean | null
          summary_strength: number | null
          window_end: string
          window_start: string
        }
        Insert: {
          id?: string
          peer_id?: string | null
          peer_trust?: number | null
          received_at?: string | null
          signals: Json
          signature_valid?: boolean | null
          summary_strength?: number | null
          window_end: string
          window_start: string
        }
        Update: {
          id?: string
          peer_id?: string | null
          peer_trust?: number | null
          received_at?: string | null
          signals?: Json
          signature_valid?: boolean | null
          summary_strength?: number | null
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "federation_inbound_signals_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_peers"
            referencedColumns: ["id"]
          },
        ]
      }
      federation_outbound_queue: {
        Row: {
          attempts: number | null
          hash: string
          id: string
          last_attempt: string | null
          payload: Json
          status: string
          window_end: string
          window_start: string
        }
        Insert: {
          attempts?: number | null
          hash: string
          id?: string
          last_attempt?: string | null
          payload: Json
          status?: string
          window_end: string
          window_start: string
        }
        Update: {
          attempts?: number | null
          hash?: string
          id?: string
          last_attempt?: string | null
          payload?: Json
          status?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      federation_peers: {
        Row: {
          base_url: string
          created_at: string | null
          id: string
          last_seen: string | null
          peer_name: string
          pubkey_pem: string
          recv_enabled: boolean | null
          send_enabled: boolean | null
          trust_score: number | null
        }
        Insert: {
          base_url: string
          created_at?: string | null
          id?: string
          last_seen?: string | null
          peer_name: string
          pubkey_pem: string
          recv_enabled?: boolean | null
          send_enabled?: boolean | null
          trust_score?: number | null
        }
        Update: {
          base_url?: string
          created_at?: string | null
          id?: string
          last_seen?: string | null
          peer_name?: string
          pubkey_pem?: string
          recv_enabled?: boolean | null
          send_enabled?: boolean | null
          trust_score?: number | null
        }
        Relationships: []
      }
      federation_policies: {
        Row: {
          data_classification: string | null
          dp_epsilon: number | null
          enabled: boolean | null
          id: string
          jurisdiction: string | null
          max_daily_weight_drift: number | null
          min_sample: number | null
          share_divisions: string[] | null
          updated_at: string | null
        }
        Insert: {
          data_classification?: string | null
          dp_epsilon?: number | null
          enabled?: boolean | null
          id?: string
          jurisdiction?: string | null
          max_daily_weight_drift?: number | null
          min_sample?: number | null
          share_divisions?: string[] | null
          updated_at?: string | null
        }
        Update: {
          data_classification?: string | null
          dp_epsilon?: number | null
          enabled?: boolean | null
          id?: string
          jurisdiction?: string | null
          max_daily_weight_drift?: number | null
          min_sample?: number | null
          share_divisions?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_data: {
        Row: {
          country: string
          created_at: string | null
          currency: string | null
          date: string
          id: string
          indicator_name: string
          iso_code: string | null
          metadata: Json | null
          source: string
          updated_at: string | null
          value: number
        }
        Insert: {
          country: string
          created_at?: string | null
          currency?: string | null
          date: string
          id?: string
          indicator_name: string
          iso_code?: string | null
          metadata?: Json | null
          source: string
          updated_at?: string | null
          value: number
        }
        Update: {
          country?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          indicator_name?: string
          iso_code?: string | null
          metadata?: Json | null
          source?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      food_data: {
        Row: {
          country: string
          created_at: string | null
          crop: string | null
          date: string
          id: string
          ipc_phase: number | null
          iso_code: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          metric_name: string
          source: string
          unit: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          country: string
          created_at?: string | null
          crop?: string | null
          date: string
          id?: string
          ipc_phase?: number | null
          iso_code?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          metric_name: string
          source: string
          unit?: string | null
          updated_at?: string | null
          value: number
        }
        Update: {
          country?: string
          created_at?: string | null
          crop?: string | null
          date?: string
          id?: string
          ipc_phase?: number | null
          iso_code?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          metric_name?: string
          source?: string
          unit?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      food_security: {
        Row: {
          alert_level: Database["public"]["Enums"]["alert_level"]
          created_at: string
          crop: string
          id: string
          metadata: Json | null
          notes: string | null
          region: string
          supply_days: number | null
          updated_at: string
          yield_index: number
        }
        Insert: {
          alert_level?: Database["public"]["Enums"]["alert_level"]
          created_at?: string
          crop: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          region: string
          supply_days?: number | null
          updated_at?: string
          yield_index: number
        }
        Update: {
          alert_level?: Database["public"]["Enums"]["alert_level"]
          created_at?: string
          crop?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          region?: string
          supply_days?: number | null
          updated_at?: string
          yield_index?: number
        }
        Relationships: []
      }
      gov_policies: {
        Row: {
          compliance_level: string | null
          created_at: string | null
          id: string
          jurisdiction: string
          last_reviewed: string | null
          source_url: string | null
          summary_md: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          compliance_level?: string | null
          created_at?: string | null
          id?: string
          jurisdiction: string
          last_reviewed?: string | null
          source_url?: string | null
          summary_md?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          compliance_level?: string | null
          created_at?: string | null
          id?: string
          jurisdiction?: string
          last_reviewed?: string | null
          source_url?: string | null
          summary_md?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      governance_assets: {
        Row: {
          asset_name: string
          asset_symbol: string
          created_at: string
          current_price: number
          enabled: boolean | null
          id: string
          market_cap: number | null
          metadata: Json | null
          price_change_24h: number | null
          total_supply: number | null
          updated_at: string
        }
        Insert: {
          asset_name: string
          asset_symbol: string
          created_at?: string
          current_price?: number
          enabled?: boolean | null
          id?: string
          market_cap?: number | null
          metadata?: Json | null
          price_change_24h?: number | null
          total_supply?: number | null
          updated_at?: string
        }
        Update: {
          asset_name?: string
          asset_symbol?: string
          created_at?: string
          current_price?: number
          enabled?: boolean | null
          id?: string
          market_cap?: number | null
          metadata?: Json | null
          price_change_24h?: number | null
          total_supply?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      governance_global: {
        Row: {
          category: string | null
          country: string
          created_at: string | null
          id: string
          indicator_name: string
          iso_code: string | null
          metadata: Json | null
          source: string
          updated_at: string | null
          value: number | null
          year: number
        }
        Insert: {
          category?: string | null
          country: string
          created_at?: string | null
          id?: string
          indicator_name: string
          iso_code?: string | null
          metadata?: Json | null
          source: string
          updated_at?: string | null
          value?: number | null
          year: number
        }
        Update: {
          category?: string | null
          country?: string
          created_at?: string | null
          id?: string
          indicator_name?: string
          iso_code?: string | null
          metadata?: Json | null
          source?: string
          updated_at?: string | null
          value?: number | null
          year?: number
        }
        Relationships: []
      }
      health_data: {
        Row: {
          affected_count: number
          containment_status: string | null
          created_at: string
          disease: string
          id: string
          metadata: Json | null
          mortality_rate: number | null
          region: string
          risk_level: Database["public"]["Enums"]["health_risk_level"]
          severity_index: number | null
          updated_at: string
        }
        Insert: {
          affected_count?: number
          containment_status?: string | null
          created_at?: string
          disease: string
          id?: string
          metadata?: Json | null
          mortality_rate?: number | null
          region: string
          risk_level: Database["public"]["Enums"]["health_risk_level"]
          severity_index?: number | null
          updated_at?: string
        }
        Update: {
          affected_count?: number
          containment_status?: string | null
          created_at?: string
          disease?: string
          id?: string
          metadata?: Json | null
          mortality_rate?: number | null
          region?: string
          risk_level?: Database["public"]["Enums"]["health_risk_level"]
          severity_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          age_group: string | null
          country: string
          created_at: string | null
          date: string
          id: string
          iso_code: string | null
          metadata: Json | null
          metric_name: string
          sex: string | null
          source: string
          unit: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          age_group?: string | null
          country: string
          created_at?: string | null
          date: string
          id?: string
          iso_code?: string | null
          metadata?: Json | null
          metric_name: string
          sex?: string | null
          source: string
          unit?: string | null
          updated_at?: string | null
          value: number
        }
        Update: {
          age_group?: string | null
          country?: string
          created_at?: string | null
          date?: string
          id?: string
          iso_code?: string | null
          metadata?: Json | null
          metric_name?: string
          sex?: string | null
          source?: string
          unit?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      intel_events: {
        Row: {
          created_at: string | null
          description: string | null
          division: string
          event_type: string
          expires_at: string | null
          id: string
          payload: Json | null
          published_at: string | null
          published_by: string | null
          severity: string
          source_system: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          division: string
          event_type: string
          expires_at?: string | null
          id?: string
          payload?: Json | null
          published_at?: string | null
          published_by?: string | null
          severity: string
          source_system?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          division?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          payload?: Json | null
          published_at?: string | null
          published_by?: string | null
          severity?: string
          source_system?: string | null
          title?: string
        }
        Relationships: []
      }
      intelligence_index: {
        Row: {
          affected_divisions: string[]
          confidence_score: number | null
          created_at: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          index_type: string
          metrics: Json | null
          priority: number | null
          recommendations_md: string | null
          summary_md: string
          title: string
          updated_at: string | null
        }
        Insert: {
          affected_divisions: string[]
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          index_type: string
          metrics?: Json | null
          priority?: number | null
          recommendations_md?: string | null
          summary_md: string
          title: string
          updated_at?: string | null
        }
        Update: {
          affected_divisions?: string[]
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          index_type?: string
          metrics?: Json | null
          priority?: number | null
          recommendations_md?: string | null
          summary_md?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ip_access_control: {
        Row: {
          access_type: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          ip_range: unknown
          org_id: string | null
          reason: string | null
        }
        Insert: {
          access_type: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          ip_address: unknown
          ip_range?: unknown
          org_id?: string | null
          reason?: string | null
        }
        Update: {
          access_type?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          ip_range?: unknown
          org_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_access_control_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          block_number: number
          created_at: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          hash: string
          id: string
          node_id: string | null
          payload: Json
          previous_hash: string | null
          signature: string | null
          timestamp: string | null
          verified: boolean | null
        }
        Insert: {
          block_number?: number
          created_at?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          hash: string
          id?: string
          node_id?: string | null
          payload: Json
          previous_hash?: string | null
          signature?: string | null
          timestamp?: string | null
          verified?: boolean | null
        }
        Update: {
          block_number?: number
          created_at?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          hash?: string
          id?: string
          node_id?: string | null
          payload?: Json
          previous_hash?: string | null
          signature?: string | null
          timestamp?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "accountability_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_root_hashes: {
        Row: {
          block_count: number
          id: string
          metadata: Json | null
          root_hash: string
          timestamp: string | null
          verified: boolean | null
        }
        Insert: {
          block_count: number
          id?: string
          metadata?: Json | null
          root_hash: string
          timestamp?: string | null
          verified?: boolean | null
        }
        Update: {
          block_count?: number
          id?: string
          metadata?: Json | null
          root_hash?: string
          timestamp?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      node_audit_trail: {
        Row: {
          action: string
          id: string
          ip_address: unknown
          metadata: Json | null
          node_id: string | null
          status: string
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          node_id?: string | null
          status: string
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          node_id?: string | null
          status?: string
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "node_audit_trail_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "accountability_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          division: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          division?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          division?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      objective_tasks: {
        Row: {
          action: string | null
          created_at: string | null
          division: string | null
          function_name: string | null
          id: string
          objective_id: string | null
          output_summary: string | null
          parameters: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          division?: string | null
          function_name?: string | null
          id?: string
          objective_id?: string | null
          output_summary?: string | null
          parameters?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          division?: string | null
          function_name?: string | null
          id?: string
          objective_id?: string | null
          output_summary?: string | null
          parameters?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objective_tasks_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          ai_plan: Json | null
          ai_summary: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          issued_by: string | null
          objective_text: string
          priority: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          ai_plan?: Json | null
          ai_summary?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          issued_by?: string | null
          objective_text: string
          priority?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          ai_plan?: Json | null
          ai_summary?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          issued_by?: string | null
          objective_text?: string
          priority?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          org_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          org_id: string | null
          plan_id: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          org_id?: string | null
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          org_id?: string | null
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          api_enabled: boolean | null
          billing_status: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          feature_flags: Json | null
          id: string
          max_api_keys: number | null
          monthly_api_quota: number | null
          name: string
          owner_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
          white_label_enabled: boolean | null
        }
        Insert: {
          api_enabled?: boolean | null
          billing_status?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          feature_flags?: Json | null
          id?: string
          max_api_keys?: number | null
          monthly_api_quota?: number | null
          name: string
          owner_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          white_label_enabled?: boolean | null
        }
        Update: {
          api_enabled?: boolean | null
          billing_status?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          feature_flags?: Json | null
          id?: string
          max_api_keys?: number | null
          monthly_api_quota?: number | null
          name?: string
          owner_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          white_label_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_oracles: {
        Row: {
          api_key_hash: string | null
          created_at: string
          enabled: boolean | null
          endpoint_url: string
          id: string
          last_sync_at: string | null
          metadata: Json | null
          partner_name: string
          response_time_avg_ms: number | null
          success_rate: number | null
          trust_score: number
          updated_at: string
        }
        Insert: {
          api_key_hash?: string | null
          created_at?: string
          enabled?: boolean | null
          endpoint_url: string
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          partner_name: string
          response_time_avg_ms?: number | null
          success_rate?: number | null
          trust_score?: number
          updated_at?: string
        }
        Update: {
          api_key_hash?: string | null
          created_at?: string
          enabled?: boolean | null
          endpoint_url?: string
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          partner_name?: string
          response_time_avg_ms?: number | null
          success_rate?: number | null
          trust_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      population_projection: {
        Row: {
          age_group: string | null
          country: string
          created_at: string | null
          density_per_km2: number | null
          id: string
          iso_code: string
          metadata: Json | null
          population: number | null
          projection_variant: string | null
          sex: string | null
          updated_at: string | null
          urban_percentage: number | null
          year: number
        }
        Insert: {
          age_group?: string | null
          country: string
          created_at?: string | null
          density_per_km2?: number | null
          id?: string
          iso_code: string
          metadata?: Json | null
          population?: number | null
          projection_variant?: string | null
          sex?: string | null
          updated_at?: string | null
          urban_percentage?: number | null
          year: number
        }
        Update: {
          age_group?: string | null
          country?: string
          created_at?: string | null
          density_per_km2?: number | null
          id?: string
          iso_code?: string
          metadata?: Json | null
          population?: number | null
          projection_variant?: string | null
          sex?: string | null
          updated_at?: string | null
          urban_percentage?: number | null
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      query_feedback: {
        Row: {
          data_sources_used: Json | null
          execution_time_ms: number | null
          id: string
          query_text: string
          response_relevance: number | null
          timestamp: string | null
          top_apis: Json
          user_id: string | null
          user_satisfaction: number | null
        }
        Insert: {
          data_sources_used?: Json | null
          execution_time_ms?: number | null
          id?: string
          query_text: string
          response_relevance?: number | null
          timestamp?: string | null
          top_apis: Json
          user_id?: string | null
          user_satisfaction?: number | null
        }
        Update: {
          data_sources_used?: Json | null
          execution_time_ms?: number | null
          id?: string
          query_text?: string
          response_relevance?: number | null
          timestamp?: string | null
          top_apis?: Json
          user_id?: string | null
          user_satisfaction?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          endpoint: string
          id: string
          ip_address: unknown
          request_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      revenue_metrics: {
        Row: {
          active_subscriptions: number | null
          arr: number | null
          avg_revenue_per_account: number | null
          churned_subscriptions: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_date: string
          mrr: number | null
          new_subscriptions: number | null
          total_revenue: number | null
        }
        Insert: {
          active_subscriptions?: number | null
          arr?: number | null
          avg_revenue_per_account?: number | null
          churned_subscriptions?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date: string
          mrr?: number | null
          new_subscriptions?: number | null
          total_revenue?: number | null
        }
        Update: {
          active_subscriptions?: number | null
          arr?: number | null
          avg_revenue_per_account?: number | null
          churned_subscriptions?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          mrr?: number | null
          new_subscriptions?: number | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      revenue_streams: {
        Row: {
          amount_usd: number
          created_at: string
          division: string
          id: string
          meta: Json | null
          source: string
          timestamp: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          division: string
          id?: string
          meta?: Json | null
          source: string
          timestamp?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          division?: string
          id?: string
          meta?: Json | null
          source?: string
          timestamp?: string
        }
        Relationships: []
      }
      risk_predictions: {
        Row: {
          affected_divisions: string[]
          confidence_level: number | null
          created_at: string | null
          description_md: string
          id: string
          impact_score: number | null
          indicators: Json | null
          mitigation_strategies_md: string | null
          model_version: string | null
          predicted_timeframe: string | null
          prediction_type: string
          probability: number | null
          risk_level: string
          title: string
          updated_at: string | null
        }
        Insert: {
          affected_divisions: string[]
          confidence_level?: number | null
          created_at?: string | null
          description_md: string
          id?: string
          impact_score?: number | null
          indicators?: Json | null
          mitigation_strategies_md?: string | null
          model_version?: string | null
          predicted_timeframe?: string | null
          prediction_type: string
          probability?: number | null
          risk_level: string
          title: string
          updated_at?: string | null
        }
        Update: {
          affected_divisions?: string[]
          confidence_level?: number | null
          created_at?: string | null
          description_md?: string
          id?: string
          impact_score?: number | null
          indicators?: Json | null
          mitigation_strategies_md?: string | null
          model_version?: string | null
          predicted_timeframe?: string | null
          prediction_type?: string
          probability?: number | null
          risk_level?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sc_allocation_policies: {
        Row: {
          constraints: Json
          created_at: string | null
          description_md: string | null
          enabled: boolean | null
          id: string
          policy_key: string
          updated_at: string | null
          weights: Json
        }
        Insert: {
          constraints?: Json
          created_at?: string | null
          description_md?: string | null
          enabled?: boolean | null
          id?: string
          policy_key: string
          updated_at?: string | null
          weights?: Json
        }
        Update: {
          constraints?: Json
          created_at?: string | null
          description_md?: string | null
          enabled?: boolean | null
          id?: string
          policy_key?: string
          updated_at?: string | null
          weights?: Json
        }
        Relationships: []
      }
      sc_oracle_prices: {
        Row: {
          captured_at: string
          confidence: number | null
          id: string
          price_usd: number
          source: string
          symbol: string
          volume_24h: number | null
        }
        Insert: {
          captured_at?: string
          confidence?: number | null
          id?: string
          price_usd: number
          source: string
          symbol: string
          volume_24h?: number | null
        }
        Update: {
          captured_at?: string
          confidence?: number | null
          id?: string
          price_usd?: number
          source?: string
          symbol?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      sc_rebalance_moves: {
        Row: {
          amount_sc: number | null
          created_at: string | null
          executed: boolean | null
          executed_at: string | null
          from_division: string | null
          id: string
          ledger_tx: Json | null
          reason: string | null
          requires_approval: boolean | null
          run_id: string | null
          to_division: string | null
        }
        Insert: {
          amount_sc?: number | null
          created_at?: string | null
          executed?: boolean | null
          executed_at?: string | null
          from_division?: string | null
          id?: string
          ledger_tx?: Json | null
          reason?: string | null
          requires_approval?: boolean | null
          run_id?: string | null
          to_division?: string | null
        }
        Update: {
          amount_sc?: number | null
          created_at?: string | null
          executed?: boolean | null
          executed_at?: string | null
          from_division?: string | null
          id?: string
          ledger_tx?: Json | null
          reason?: string | null
          requires_approval?: boolean | null
          run_id?: string | null
          to_division?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sc_rebalance_moves_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sc_rebalance_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sc_rebalance_runs: {
        Row: {
          created_at: string | null
          created_by: string | null
          finished_at: string | null
          id: string
          mode: string
          notes: string | null
          policy_key: string
          status: string
          total_available_sc: number | null
          total_moved_sc: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          finished_at?: string | null
          id?: string
          mode: string
          notes?: string | null
          policy_key: string
          status?: string
          total_available_sc?: number | null
          total_moved_sc?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          notes?: string | null
          policy_key?: string
          status?: string
          total_available_sc?: number | null
          total_moved_sc?: number | null
        }
        Relationships: []
      }
      sdg_mappings: {
        Row: {
          created_at: string | null
          division_key: string
          id: string
          indicator: string
          metric_source: string
          sdg_goal: number
          sdg_target: string
        }
        Insert: {
          created_at?: string | null
          division_key: string
          id?: string
          indicator: string
          metric_source: string
          sdg_goal: number
          sdg_target: string
        }
        Update: {
          created_at?: string | null
          division_key?: string
          id?: string
          indicator?: string
          metric_source?: string
          sdg_goal?: number
          sdg_target?: string
        }
        Relationships: []
      }
      sdg_progress: {
        Row: {
          current_value: number | null
          goal: number
          id: string
          progress_percent: number | null
          target: string
          updated_at: string | null
        }
        Insert: {
          current_value?: number | null
          goal: number
          id?: string
          progress_percent?: number | null
          target: string
          updated_at?: string | null
        }
        Update: {
          current_value?: number | null
          goal?: number
          id?: string
          progress_percent?: number | null
          target?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          affected_systems: Json | null
          created_at: string | null
          cve_id: string | null
          description: string | null
          detected_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          severity: string
          source: string
          threat_score: number | null
          title: string
        }
        Insert: {
          affected_systems?: Json | null
          created_at?: string | null
          cve_id?: string | null
          description?: string | null
          detected_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          severity: string
          source: string
          threat_score?: number | null
          title: string
        }
        Update: {
          affected_systems?: Json | null
          created_at?: string | null
          cve_id?: string | null
          description?: string | null
          detected_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          severity?: string
          source?: string
          threat_score?: number | null
          title?: string
        }
        Relationships: []
      }
      security_vulnerabilities: {
        Row: {
          affected_products: string[] | null
          created_at: string | null
          cve_id: string
          cvss_score: number | null
          description: string | null
          id: string
          last_modified: string | null
          published_date: string | null
          reference_links: Json | null
          severity: string
          updated_at: string | null
        }
        Insert: {
          affected_products?: string[] | null
          created_at?: string | null
          cve_id: string
          cvss_score?: number | null
          description?: string | null
          id?: string
          last_modified?: string | null
          published_date?: string | null
          reference_links?: Json | null
          severity: string
          updated_at?: string | null
        }
        Update: {
          affected_products?: string[] | null
          created_at?: string | null
          cve_id?: string
          cvss_score?: number | null
          description?: string | null
          id?: string
          last_modified?: string | null
          published_date?: string | null
          reference_links?: Json | null
          severity?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          features: Json
          id: string
          key: string
          name: string
          price_usd: number
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          features: Json
          id?: string
          key: string
          name: string
          price_usd: number
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          features?: Json
          id?: string
          key?: string
          name?: string
          price_usd?: number
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      system_health: {
        Row: {
          checked_at: string
          component: string
          error_message: string | null
          id: string
          metadata: Json | null
          response_time_ms: number | null
          status: string
        }
        Insert: {
          checked_at?: string
          component: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          status: string
        }
        Update: {
          checked_at?: string
          component?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          division: string | null
          id: string
          log_level: Database["public"]["Enums"]["log_level"]
          metadata: Json | null
          result: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          division?: string | null
          id?: string
          log_level?: Database["public"]["Enums"]["log_level"]
          metadata?: Json | null
          result?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          division?: string | null
          id?: string
          log_level?: Database["public"]["Enums"]["log_level"]
          metadata?: Json | null
          result?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_action_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          org_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_action_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_metrics: {
        Row: {
          active_users_count: number | null
          api_requests_count: number | null
          avg_response_time_ms: number | null
          cost_estimate_usd: number | null
          database_queries_count: number | null
          edge_function_invocations: number | null
          error_count: number | null
          id: string
          metric_date: string
          org_id: string
          storage_used_bytes: number | null
        }
        Insert: {
          active_users_count?: number | null
          api_requests_count?: number | null
          avg_response_time_ms?: number | null
          cost_estimate_usd?: number | null
          database_queries_count?: number | null
          edge_function_invocations?: number | null
          error_count?: number | null
          id?: string
          metric_date?: string
          org_id: string
          storage_used_bytes?: number | null
        }
        Update: {
          active_users_count?: number | null
          api_requests_count?: number | null
          avg_response_time_ms?: number | null
          cost_estimate_usd?: number | null
          database_queries_count?: number | null
          edge_function_invocations?: number | null
          error_count?: number | null
          id?: string
          metric_date?: string
          org_id?: string
          storage_used_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_onboarding: {
        Row: {
          branding_complete: boolean | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          domain_complete: boolean | null
          id: string
          org_id: string
          plan_complete: boolean | null
          profile_complete: boolean | null
          step: string
          updated_at: string | null
        }
        Insert: {
          branding_complete?: boolean | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          domain_complete?: boolean | null
          id?: string
          org_id: string
          plan_complete?: boolean | null
          profile_complete?: boolean | null
          step?: string
          updated_at?: string | null
        }
        Update: {
          branding_complete?: boolean | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          domain_complete?: boolean | null
          id?: string
          org_id?: string
          plan_complete?: boolean | null
          profile_complete?: boolean | null
          step?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_onboarding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_logs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          neutralized: boolean
          resolved_at: string | null
          response_time_ms: number | null
          severity: Database["public"]["Enums"]["threat_severity"]
          threat_type: Database["public"]["Enums"]["threat_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          neutralized?: boolean
          resolved_at?: string | null
          response_time_ms?: number | null
          severity: Database["public"]["Enums"]["threat_severity"]
          threat_type: Database["public"]["Enums"]["threat_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          neutralized?: boolean
          resolved_at?: string | null
          response_time_ms?: number | null
          severity?: Database["public"]["Enums"]["threat_severity"]
          threat_type?: Database["public"]["Enums"]["threat_type"]
        }
        Relationships: []
      }
      trades: {
        Row: {
          amount: number
          created_at: string
          exchange: string
          executed_at: string | null
          id: string
          pair: string
          price: number
          profit: number | null
          side: Database["public"]["Enums"]["trade_side"]
          status: Database["public"]["Enums"]["trade_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          exchange: string
          executed_at?: string | null
          id?: string
          pair: string
          price: number
          profit?: number | null
          side: Database["public"]["Enums"]["trade_side"]
          status?: Database["public"]["Enums"]["trade_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          exchange?: string
          executed_at?: string | null
          id?: string
          pair?: string
          price?: number
          profit?: number | null
          side?: Database["public"]["Enums"]["trade_side"]
          status?: Database["public"]["Enums"]["trade_status"]
        }
        Relationships: []
      }
      transparency_reports: {
        Row: {
          avg_trust_score: number | null
          created_at: string | null
          data_breaches_count: number | null
          ethics_appeals_count: number | null
          gdpr_requests_count: number | null
          id: string
          published_at: string | null
          report_content: string | null
          report_period_end: string
          report_period_start: string
          signed_hash: string | null
          total_decisions: number | null
          total_users: number | null
        }
        Insert: {
          avg_trust_score?: number | null
          created_at?: string | null
          data_breaches_count?: number | null
          ethics_appeals_count?: number | null
          gdpr_requests_count?: number | null
          id?: string
          published_at?: string | null
          report_content?: string | null
          report_period_end: string
          report_period_start: string
          signed_hash?: string | null
          total_decisions?: number | null
          total_users?: number | null
        }
        Update: {
          avg_trust_score?: number | null
          created_at?: string | null
          data_breaches_count?: number | null
          ethics_appeals_count?: number | null
          gdpr_requests_count?: number | null
          id?: string
          published_at?: string | null
          report_content?: string | null
          report_period_end?: string
          report_period_start?: string
          signed_hash?: string | null
          total_decisions?: number | null
          total_users?: number | null
        }
        Relationships: []
      }
      trust_metrics: {
        Row: {
          computed_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          metric_unit: string | null
          metric_value: number
          signature: string | null
        }
        Insert: {
          computed_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_unit?: string | null
          metric_value: number
          signature?: string | null
        }
        Update: {
          computed_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_unit?: string | null
          metric_value?: number
          signature?: string | null
        }
        Relationships: []
      }
      usage_metrics: {
        Row: {
          created_at: string | null
          id: string
          metric_key: string
          metric_value: number | null
          org_id: string | null
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_key: string
          metric_value?: number | null
          org_id?: string | null
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_key?: string
          metric_value?: number | null
          org_id?: string | null
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          billed: boolean | null
          created_at: string | null
          id: string
          metric_key: string
          org_id: string
          period_end: string
          period_start: string
          quantity: number
          stripe_usage_record_id: string | null
          updated_at: string | null
        }
        Insert: {
          billed?: boolean | null
          created_at?: string | null
          id?: string
          metric_key: string
          org_id: string
          period_end: string
          period_start: string
          quantity?: number
          stripe_usage_record_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billed?: boolean | null
          created_at?: string | null
          id?: string
          metric_key?: string
          org_id?: string
          period_end?: string
          period_start?: string
          quantity?: number
          stripe_usage_record_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consent: {
        Row: {
          accepted_at: string
          created_at: string | null
          id: string
          retention_days: number
          revoked_at: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string | null
          id?: string
          retention_days?: number
          revoked_at?: string | null
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          created_at?: string | null
          id?: string
          retention_days?: number
          revoked_at?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          last_active_at: string
          revoke_reason: string | null
          revoked_at: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: unknown
          last_active_at?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          last_active_at?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vulnerability_scores: {
        Row: {
          calculated_at: string | null
          climate_risk: number | null
          confidence: number | null
          country: string
          created_at: string | null
          data_sources: Json | null
          economic_risk: number | null
          energy_risk: number | null
          food_risk: number | null
          governance_risk: number | null
          health_risk: number | null
          id: string
          iso_code: string
          latitude: number | null
          longitude: number | null
          overall_score: number
          population: number | null
        }
        Insert: {
          calculated_at?: string | null
          climate_risk?: number | null
          confidence?: number | null
          country: string
          created_at?: string | null
          data_sources?: Json | null
          economic_risk?: number | null
          energy_risk?: number | null
          food_risk?: number | null
          governance_risk?: number | null
          health_risk?: number | null
          id?: string
          iso_code: string
          latitude?: number | null
          longitude?: number | null
          overall_score: number
          population?: number | null
        }
        Update: {
          calculated_at?: string | null
          climate_risk?: number | null
          confidence?: number | null
          country?: string
          created_at?: string | null
          data_sources?: Json | null
          economic_risk?: number | null
          energy_risk?: number | null
          food_risk?: number | null
          governance_risk?: number | null
          health_risk?: number | null
          id?: string
          iso_code?: string
          latitude?: number | null
          longitude?: number | null
          overall_score?: number
          population?: number | null
        }
        Relationships: []
      }
      webhook_event_log: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          webhook_source: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          webhook_source?: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          webhook_source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_ip_access: {
        Args: { _ip_address: unknown; _org_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          _endpoint: string
          _ip: unknown
          _limit?: number
          _user_id: string
          _window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_exports: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _ip_address?: unknown
          _metadata?: Json
          _org_id: string
          _resource_id?: string
          _resource_type?: string
          _severity?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      access_tier: "public" | "institutional" | "administrative"
      alert_level:
        | "stable"
        | "monitoring"
        | "warning"
        | "critical"
        | "emergency"
      app_role: "admin" | "operator" | "observer"
      data_purpose:
        | "analytics"
        | "reporting"
        | "research"
        | "crisis_response"
        | "policy_making"
        | "audit"
      division_status:
        | "optimal"
        | "operational"
        | "active"
        | "degraded"
        | "offline"
      health_risk_level: "minimal" | "low" | "moderate" | "high" | "critical"
      ledger_entry_type:
        | "ethics"
        | "sdg"
        | "finance"
        | "policy"
        | "crisis"
        | "compliance"
      log_level: "info" | "warning" | "error" | "critical" | "success"
      org_type: "government" | "ngo" | "agency" | "academic" | "private"
      stability_status:
        | "stable"
        | "fluctuating"
        | "stressed"
        | "critical"
        | "failure"
      threat_severity: "low" | "medium" | "high" | "critical"
      threat_type:
        | "cyber"
        | "physical"
        | "network"
        | "data_breach"
        | "intrusion"
        | "malware"
      trade_side: "buy" | "sell"
      trade_status: "pending" | "executed" | "failed" | "cancelled"
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
    Enums: {
      access_tier: ["public", "institutional", "administrative"],
      alert_level: ["stable", "monitoring", "warning", "critical", "emergency"],
      app_role: ["admin", "operator", "observer"],
      data_purpose: [
        "analytics",
        "reporting",
        "research",
        "crisis_response",
        "policy_making",
        "audit",
      ],
      division_status: [
        "optimal",
        "operational",
        "active",
        "degraded",
        "offline",
      ],
      health_risk_level: ["minimal", "low", "moderate", "high", "critical"],
      ledger_entry_type: [
        "ethics",
        "sdg",
        "finance",
        "policy",
        "crisis",
        "compliance",
      ],
      log_level: ["info", "warning", "error", "critical", "success"],
      org_type: ["government", "ngo", "agency", "academic", "private"],
      stability_status: [
        "stable",
        "fluctuating",
        "stressed",
        "critical",
        "failure",
      ],
      threat_severity: ["low", "medium", "high", "critical"],
      threat_type: [
        "cyber",
        "physical",
        "network",
        "data_breach",
        "intrusion",
        "malware",
      ],
      trade_side: ["buy", "sell"],
      trade_status: ["pending", "executed", "failed", "cancelled"],
    },
  },
} as const
