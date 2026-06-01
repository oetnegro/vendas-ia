export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type AgentStatus = 'draft' | 'active' | 'paused'
export type CampaignStatus = 'draft' | 'approved' | 'active' | 'paused' | 'completed'
export type GoogleConnectionStatus = 'pending' | 'connected' | 'revoked' | 'error'
export type LeadStatus =
  | 'new'
  | 'queued'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'meeting_booked'
  | 'negative'
  | 'opted_out'
  | 'paused'
export type SendJobStatus = 'queued' | 'running' | 'sent' | 'failed' | 'cancelled' | 'blocked'

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
          updated_at: string
          onboarding_step: number
        }
        Insert: {
          id?: string
          name: string
          created_by?: string
          created_at?: string
          updated_at?: string
          onboarding_step?: number
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          created_at?: string
          updated_at?: string
          onboarding_step?: number
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: WorkspaceRole
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: WorkspaceRole
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: WorkspaceRole
          created_at?: string
        }
        Relationships: Relationship[]
      }
      google_connections: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          google_email: string | null
          scopes: string[]
          access_token_ciphertext: string | null
          refresh_token_ciphertext: string | null
          expires_at: string | null
          status: GoogleConnectionStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          google_email?: string | null
          scopes?: string[]
          access_token_ciphertext?: string | null
          refresh_token_ciphertext?: string | null
          expires_at?: string | null
          status?: GoogleConnectionStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          google_email?: string | null
          scopes?: string[]
          access_token_ciphertext?: string | null
          refresh_token_ciphertext?: string | null
          expires_at?: string | null
          status?: GoogleConnectionStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: Relationship[]
      }
      google_oauth_states: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          state: string
          redirect_to: string | null
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          state: string
          redirect_to?: string | null
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          state?: string
          redirect_to?: string | null
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      agents: {
        Row: {
          id: string
          workspace_id: string
          name: string
          business_context: string | null
          common_objections: string | null
          campaign_goal: string | null
          status: AgentStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          business_context?: string | null
          common_objections?: string | null
          campaign_goal?: string | null
          status?: AgentStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          business_context?: string | null
          common_objections?: string | null
          campaign_goal?: string | null
          status?: AgentStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: Relationship[]
      }
      campaigns: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string | null
          name: string
          objective: string | null
          status: CampaignStatus
          monthly_lead_limit: number
          daily_send_limit: number
          sending_window: Json
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id?: string | null
          name: string
          objective?: string | null
          status?: CampaignStatus
          monthly_lead_limit?: number
          daily_send_limit?: number
          sending_window?: Json
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string | null
          name?: string
          objective?: string | null
          status?: CampaignStatus
          monthly_lead_limit?: number
          daily_send_limit?: number
          sending_window?: Json
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: Relationship[]
      }
      cadence_steps: {
        Row: {
          id: string
          workspace_id: string
          campaign_id: string
          step_order: number
          delay_days: number
          subject: string
          body: string
          requires_approval: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          campaign_id: string
          step_order: number
          delay_days?: number
          subject: string
          body: string
          requires_approval?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          campaign_id?: string
          step_order?: number
          delay_days?: number
          subject?: string
          body?: string
          requires_approval?: boolean
          created_at?: string
        }
        Relationships: Relationship[]
      }
      leads: {
        Row: {
          id: string
          workspace_id: string
          campaign_id: string | null
          email: string
          first_name: string | null
          last_name: string | null
          company: string | null
          title: string | null
          source: string | null
          status: LeadStatus
          custom_fields: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          campaign_id?: string | null
          email: string
          first_name?: string | null
          last_name?: string | null
          company?: string | null
          title?: string | null
          source?: string | null
          status?: LeadStatus
          custom_fields?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          campaign_id?: string | null
          email?: string
          first_name?: string | null
          last_name?: string | null
          company?: string | null
          title?: string | null
          source?: string | null
          status?: LeadStatus
          custom_fields?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: Relationship[]
      }
      email_threads: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string
          gmail_thread_id: string | null
          status: string
          ai_enabled: boolean
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id: string
          gmail_thread_id?: string | null
          status?: string
          ai_enabled?: boolean
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string
          gmail_thread_id?: string | null
          status?: string
          ai_enabled?: boolean
          last_message_at?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      email_messages: {
        Row: {
          id: string
          workspace_id: string
          thread_id: string
          lead_id: string
          gmail_message_id: string | null
          direction: 'inbound' | 'outbound'
          subject: string | null
          body_text: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          thread_id: string
          lead_id: string
          gmail_message_id?: string | null
          direction: 'inbound' | 'outbound'
          subject?: string | null
          body_text?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          thread_id?: string
          lead_id?: string
          gmail_message_id?: string | null
          direction?: 'inbound' | 'outbound'
          subject?: string | null
          body_text?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      send_jobs: {
        Row: {
          id: string
          workspace_id: string
          campaign_id: string
          cadence_step_id: string | null
          lead_id: string
          status: SendJobStatus
          scheduled_for: string
          sent_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          campaign_id: string
          cadence_step_id?: string | null
          lead_id: string
          status?: SendJobStatus
          scheduled_for: string
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          campaign_id?: string
          cadence_step_id?: string | null
          lead_id?: string
          status?: SendJobStatus
          scheduled_for?: string
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: Relationship[]
      }
      opt_outs: {
        Row: {
          id: string
          workspace_id: string
          email: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      activity_logs: {
        Row: {
          id: string
          workspace_id: string
          actor_user_id: string | null
          entity_type: string
          entity_id: string | null
          action: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          actor_user_id?: string | null
          entity_type: string
          entity_id?: string | null
          action: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          actor_user_id?: string | null
          entity_type?: string
          entity_id?: string | null
          action?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: Relationship[]
      }
      email_ai_actions: {
        Row: {
          id: string
          workspace_id: string
          thread_id: string
          lead_id: string
          inbound_message_id: string | null
          action: string
          intent: string | null
          confidence: number | null
          summary: string | null
          response_subject: string | null
          response_body: string | null
          sent_message_id: string | null
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          thread_id: string
          lead_id: string
          inbound_message_id?: string | null
          action: string
          intent?: string | null
          confidence?: number | null
          summary?: string | null
          response_subject?: string | null
          response_body?: string | null
          sent_message_id?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          thread_id?: string
          lead_id?: string
          inbound_message_id?: string | null
          action?: string
          intent?: string | null
          confidence?: number | null
          summary?: string | null
          response_subject?: string | null
          response_body?: string | null
          sent_message_id?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: Relationship[]
      }
      leads_formulario: {
        Row: {
          id: string
          nome: string
          email: string
          telefone: string
          empresa: string
          tamanho_equipe: string
          desafio: string
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          email: string
          telefone: string
          empresa: string
          tamanho_equipe: string
          desafio: string
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          telefone?: string
          empresa?: string
          tamanho_equipe?: string
          desafio?: string
          created_at?: string
        }
        Relationships: []
      }
      enrichment_jobs: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          prompt: string
          apify_actor: string
          apify_run_id: string | null
          params_json: Json | null
          status: string
          cost_usd: number | null
          result_count: number
          leads_imported: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          prompt: string
          apify_actor: string
          apify_run_id?: string | null
          params_json?: Json | null
          status?: string
          cost_usd?: number | null
          result_count?: number
          leads_imported?: number
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          prompt?: string
          apify_actor?: string
          apify_run_id?: string | null
          params_json?: Json | null
          status?: string
          cost_usd?: number | null
          result_count?: number
          leads_imported?: number
          created_at?: string
        }
        Relationships: []
      }
      workspace_api_tokens: {
        Row: {
          id: string
          workspace_id: string
          name: string
          token_prefix: string
          token_hash: string
          scopes: string[]
          created_by: string | null
          last_used_at: string | null
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          token_prefix: string
          token_hash: string
          scopes?: string[]
          created_by?: string | null
          last_used_at?: string | null
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          token_prefix?: string
          token_hash?: string
          scopes?: string[]
          created_by?: string | null
          last_used_at?: string | null
          created_at?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      complete_google_oauth_connection: {
        Args: {
          connection_state: string
          google_email_value: string
          scopes_value: string[]
          access_token_value: string
          refresh_token_value: string | null
          expires_at_value: string
        }
        Returns: string
      }
      disconnect_google_connection: {
        Args: {
          target_workspace_id: string
        }
        Returns: undefined
      }
      get_google_connection_status: {
        Args: {
          target_workspace_id: string
        }
        Returns: {
          google_email: string | null
          status: GoogleConnectionStatus
          expires_at: string | null
          updated_at: string
          scopes: string[]
        }[]
      }
    }
    Enums: {
      agent_status: AgentStatus
      campaign_status: CampaignStatus
      google_connection_status: GoogleConnectionStatus
      lead_status: LeadStatus
      send_job_status: SendJobStatus
      workspace_role: WorkspaceRole
    }
    CompositeTypes: Record<string, never>
  }
}
