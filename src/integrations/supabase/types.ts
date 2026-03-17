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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      aprovacoes: {
        Row: {
          aprovador_id: string
          created_at: string
          data_aprovacao: string
          id: string
          observacoes: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          aprovador_id: string
          created_at?: string
          data_aprovacao?: string
          id?: string
          observacoes?: string | null
          status: string
          ticket_id: string
        }
        Update: {
          aprovador_id?: string
          created_at?: string
          data_aprovacao?: string
          id?: string
          observacoes?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          performed_at: string
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj_cpf: string | null
          created_at: string
          empresa: string | null
          endereco: string | null
          estado: string | null
          geocoded_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          prioridade: number | null
          profile_id: string | null
          ufv_solarz: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          empresa?: string | null
          endereco?: string | null
          estado?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          prioridade?: number | null
          profile_id?: string | null
          ufv_solarz?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          empresa?: string | null
          endereco?: string | null
          estado?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          prioridade?: number | null
          profile_id?: string | null
          ufv_solarz?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_retry_queue: {
        Row: {
          attempt_count: number
          created_at: string
          email_type: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_retry_at: string
          payload: Json
          recipients: string[]
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          email_type: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at: string
          payload: Json
          recipients: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          email_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload?: Json
          recipients?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          capacidade: string | null
          cliente_id: string | null
          corrente: string | null
          created_at: string
          data_instalacao: string | null
          fabricante: string | null
          garantia: string | null
          id: string
          localizacao: string | null
          modelo: string | null
          nome: string
          numero_serie: string | null
          observacoes: string | null
          qr_code_data: Json | null
          status: string
          tensao: string | null
          tipo: Database["public"]["Enums"]["equipamento_tipo"]
          updated_at: string
        }
        Insert: {
          capacidade?: string | null
          cliente_id?: string | null
          corrente?: string | null
          created_at?: string
          data_instalacao?: string | null
          fabricante?: string | null
          garantia?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          nome: string
          numero_serie?: string | null
          observacoes?: string | null
          qr_code_data?: Json | null
          status?: string
          tensao?: string | null
          tipo: Database["public"]["Enums"]["equipamento_tipo"]
          updated_at?: string
        }
        Update: {
          capacidade?: string | null
          cliente_id?: string | null
          corrente?: string | null
          created_at?: string
          data_instalacao?: string | null
          fabricante?: string | null
          garantia?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          nome?: string
          numero_serie?: string | null
          observacoes?: string | null
          qr_code_data?: Json | null
          status?: string
          tensao?: string | null
          tipo?: Database["public"]["Enums"]["equipamento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      geocoding_cache: {
        Row: {
          address_normalized: string
          cached_at: string
          created_at: string
          formatted_address: string | null
          hit_count: number | null
          id: string
          latitude: number
          longitude: number
          original_address: string
          updated_at: string
        }
        Insert: {
          address_normalized: string
          cached_at?: string
          created_at?: string
          formatted_address?: string | null
          hit_count?: number | null
          id?: string
          latitude: number
          longitude: number
          original_address: string
          updated_at?: string
        }
        Update: {
          address_normalized?: string
          cached_at?: string
          created_at?: string
          formatted_address?: string | null
          hit_count?: number | null
          id?: string
          latitude?: number
          longitude?: number
          original_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      geocoding_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          categoria: string
          created_at: string | null
          estoque_critico: number | null
          estoque_minimo: number | null
          fornecedor: string | null
          id: string
          localizacao: string | null
          nome: string
          observacoes: string | null
          preco: number | null
          quantidade: number
          unidade: string
          updated_at: string | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          estoque_critico?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          observacoes?: string | null
          preco?: number | null
          quantidade?: number
          unidade?: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          estoque_critico?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          observacoes?: string | null
          preco?: number | null
          quantidade?: number
          unidade?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          created_at: string | null
          data_movimentacao: string | null
          id: string
          insumo_id: string
          motivo: string | null
          observacoes: string | null
          quantidade: number
          responsavel_id: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          data_movimentacao?: string | null
          id?: string
          insumo_id: string
          motivo?: string | null
          observacoes?: string | null
          quantidade: number
          responsavel_id: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          data_movimentacao?: string | null
          id?: string
          insumo_id?: string
          motivo?: string | null
          observacoes?: string | null
          quantidade?: number
          responsavel_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          assinatura_cliente: string | null
          assinatura_tecnico: string | null
          calendar_invite_recipients: string[] | null
          calendar_invite_sent_at: string | null
          created_at: string
          data_assinatura_cliente: string | null
          data_assinatura_tecnico: string | null
          data_emissao: string
          data_programada: string | null
          duracao_estimada_min: number | null
          email_error_log: Json | null
          equipe: string[] | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          inspetor_responsavel: string | null
          nome_cliente_assinatura: string | null
          notes: string | null
          numero_os: string
          pdf_url: string | null
          presence_confirmed_at: string | null
          presence_confirmed_by: string | null
          qr_code: string | null
          reminder_sent_at: string | null
          servico_solicitado: string | null
          site_name: string | null
          tecnico_id: string | null
          ticket_id: string
          tipo_trabalho: string[] | null
          updated_at: string
          work_type: Json | null
        }
        Insert: {
          assinatura_cliente?: string | null
          assinatura_tecnico?: string | null
          calendar_invite_recipients?: string[] | null
          calendar_invite_sent_at?: string | null
          created_at?: string
          data_assinatura_cliente?: string | null
          data_assinatura_tecnico?: string | null
          data_emissao?: string
          data_programada?: string | null
          duracao_estimada_min?: number | null
          email_error_log?: Json | null
          equipe?: string[] | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inspetor_responsavel?: string | null
          nome_cliente_assinatura?: string | null
          notes?: string | null
          numero_os: string
          pdf_url?: string | null
          presence_confirmed_at?: string | null
          presence_confirmed_by?: string | null
          qr_code?: string | null
          reminder_sent_at?: string | null
          servico_solicitado?: string | null
          site_name?: string | null
          tecnico_id?: string | null
          ticket_id: string
          tipo_trabalho?: string[] | null
          updated_at?: string
          work_type?: Json | null
        }
        Update: {
          assinatura_cliente?: string | null
          assinatura_tecnico?: string | null
          calendar_invite_recipients?: string[] | null
          calendar_invite_sent_at?: string | null
          created_at?: string
          data_assinatura_cliente?: string | null
          data_assinatura_tecnico?: string | null
          data_emissao?: string
          data_programada?: string | null
          duracao_estimada_min?: number | null
          email_error_log?: Json | null
          equipe?: string[] | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inspetor_responsavel?: string | null
          nome_cliente_assinatura?: string | null
          notes?: string | null
          numero_os?: string
          pdf_url?: string | null
          presence_confirmed_at?: string | null
          presence_confirmed_by?: string | null
          qr_code?: string | null
          reminder_sent_at?: string | null
          servico_solicitado?: string | null
          site_name?: string | null
          tecnico_id?: string | null
          ticket_id?: string
          tipo_trabalho?: string[] | null
          updated_at?: string
          work_type?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_confirmation_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string
          ordem_servico_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address: string
          ordem_servico_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string
          ordem_servico_id?: string
        }
        Relationships: []
      }
      presence_confirmation_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ordem_servico_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ordem_servico_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ordem_servico_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presence_confirmation_tokens_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores: {
        Row: {
          ativo: boolean
          categoria: string
          cep: string | null
          certificacoes: string[] | null
          cidade: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          email: string
          endereco: string | null
          especialidades: string[] | null
          estado: string | null
          experiencia: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          cep?: string | null
          certificacoes?: string[] | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          email: string
          endereco?: string | null
          especialidades?: string[] | null
          estado?: string | null
          experiencia?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cep?: string | null
          certificacoes?: string[] | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          email?: string
          endereco?: string | null
          especialidades?: string[] | null
          estado?: string | null
          experiencia?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          ativo: boolean | null
          contato: string | null
          created_at: string | null
          id: string
          nome: string
          observacoes: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          contato?: string | null
          created_at?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          contato?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rme_checklist_catalog: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_default: boolean | null
          item_key: string
          label: string
          sort_order: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          item_key: string
          label: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          item_key?: string
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      rme_checklist_items: {
        Row: {
          category: string
          checked: boolean | null
          created_at: string | null
          id: string
          item_key: string
          label: string
          rme_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          checked?: boolean | null
          created_at?: string | null
          id?: string
          item_key: string
          label: string
          rme_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          checked?: boolean | null
          created_at?: string | null
          id?: string
          item_key?: string
          label?: string
          rme_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rme_checklist_items_rme_id_fkey"
            columns: ["rme_id"]
            isOneToOne: false
            referencedRelation: "rme_relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      rme_relatorios: {
        Row: {
          anexos_tecnicos: string[] | null
          aprovado_por: string | null
          assinatura_cliente: string | null
          assinatura_tecnico: string | null
          collaboration: Json | null
          condicoes_encontradas: string
          created_at: string
          data_aprovacao: string | null
          data_execucao: string
          data_preenchimento: string
          end_time: string | null
          equipamento_id: string | null
          fotos_antes: string[] | null
          fotos_depois: string[] | null
          id: string
          images_posted: boolean | null
          inverter_number: string | null
          materiais_utilizados: Json | null
          medicoes_eletricas: Json | null
          micro_number: string | null
          modules_cleaned_qty: number | null
          nome_cliente_assinatura: string | null
          observacoes_aprovacao: string | null
          observacoes_tecnicas: string | null
          ordem_servico_id: string
          pdf_url: string | null
          service_type: Json | null
          servicos_executados: string
          shift: string | null
          signatures: Json | null
          site_name: string | null
          start_time: string | null
          status: string | null
          status_aprovacao: string
          string_box_qty: number | null
          tecnico_id: string
          testes_realizados: string | null
          ticket_id: string
          updated_at: string
          weekday: string | null
        }
        Insert: {
          anexos_tecnicos?: string[] | null
          aprovado_por?: string | null
          assinatura_cliente?: string | null
          assinatura_tecnico?: string | null
          collaboration?: Json | null
          condicoes_encontradas: string
          created_at?: string
          data_aprovacao?: string | null
          data_execucao: string
          data_preenchimento?: string
          end_time?: string | null
          equipamento_id?: string | null
          fotos_antes?: string[] | null
          fotos_depois?: string[] | null
          id?: string
          images_posted?: boolean | null
          inverter_number?: string | null
          materiais_utilizados?: Json | null
          medicoes_eletricas?: Json | null
          micro_number?: string | null
          modules_cleaned_qty?: number | null
          nome_cliente_assinatura?: string | null
          observacoes_aprovacao?: string | null
          observacoes_tecnicas?: string | null
          ordem_servico_id: string
          pdf_url?: string | null
          service_type?: Json | null
          servicos_executados: string
          shift?: string | null
          signatures?: Json | null
          site_name?: string | null
          start_time?: string | null
          status?: string | null
          status_aprovacao?: string
          string_box_qty?: number | null
          tecnico_id: string
          testes_realizados?: string | null
          ticket_id: string
          updated_at?: string
          weekday?: string | null
        }
        Update: {
          anexos_tecnicos?: string[] | null
          aprovado_por?: string | null
          assinatura_cliente?: string | null
          assinatura_tecnico?: string | null
          collaboration?: Json | null
          condicoes_encontradas?: string
          created_at?: string
          data_aprovacao?: string | null
          data_execucao?: string
          data_preenchimento?: string
          end_time?: string | null
          equipamento_id?: string | null
          fotos_antes?: string[] | null
          fotos_depois?: string[] | null
          id?: string
          images_posted?: boolean | null
          inverter_number?: string | null
          materiais_utilizados?: Json | null
          medicoes_eletricas?: Json | null
          micro_number?: string | null
          modules_cleaned_qty?: number | null
          nome_cliente_assinatura?: string | null
          observacoes_aprovacao?: string | null
          observacoes_tecnicas?: string | null
          ordem_servico_id?: string
          pdf_url?: string | null
          service_type?: Json | null
          servicos_executados?: string
          shift?: string | null
          signatures?: Json | null
          site_name?: string | null
          start_time?: string | null
          status?: string | null
          status_aprovacao?: string
          string_box_qty?: number | null
          tecnico_id?: string
          testes_realizados?: string | null
          ticket_id?: string
          updated_at?: string
          weekday?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rme_relatorios_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rme_relatorios_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: true
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rme_relatorios_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rme_relatorios_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      route_optimizations: {
        Row: {
          created_at: string
          data_rota: string
          distance_km: number
          duration_minutes: number
          geometry: Json
          id: string
          optimization_method: string
          tecnico_id: string
          ticket_ids: string[]
          updated_at: string
          waypoints_order: Json
        }
        Insert: {
          created_at?: string
          data_rota: string
          distance_km: number
          duration_minutes: number
          geometry: Json
          id?: string
          optimization_method: string
          tecnico_id: string
          ticket_ids: string[]
          updated_at?: string
          waypoints_order: Json
        }
        Update: {
          created_at?: string
          data_rota?: string
          distance_km?: number
          duration_minutes?: number
          geometry?: Json
          id?: string
          optimization_method?: string
          tecnico_id?: string
          ticket_ids?: string[]
          updated_at?: string
          waypoints_order?: Json
        }
        Relationships: [
          {
            foreignKeyName: "route_optimizations_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      status_historico: {
        Row: {
          alterado_por: string | null
          data_alteracao: string
          id: string
          observacoes: string | null
          status_anterior: Database["public"]["Enums"]["ticket_status"] | null
          status_novo: Database["public"]["Enums"]["ticket_status"]
          ticket_id: string
        }
        Insert: {
          alterado_por?: string | null
          data_alteracao?: string
          id?: string
          observacoes?: string | null
          status_anterior?: Database["public"]["Enums"]["ticket_status"] | null
          status_novo: Database["public"]["Enums"]["ticket_status"]
          ticket_id: string
        }
        Update: {
          alterado_por?: string | null
          data_alteracao?: string
          id?: string
          observacoes?: string | null
          status_anterior?: Database["public"]["Enums"]["ticket_status"] | null
          status_novo?: Database["public"]["Enums"]["ticket_status"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_historico_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tecnicos: {
        Row: {
          created_at: string
          especialidades: string[] | null
          id: string
          profile_id: string
          regiao_atuacao: string | null
          registro_profissional: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          especialidades?: string[] | null
          id?: string
          profile_id: string
          regiao_atuacao?: string | null
          registro_profissional?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          especialidades?: string[] | null
          id?: string
          profile_id?: string
          regiao_atuacao?: string | null
          registro_profissional?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tecnicos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          anexos: string[] | null
          can_create_rme: boolean | null
          cliente_id: string
          created_at: string
          created_by: string
          data_abertura: string
          data_conclusao: string | null
          data_inicio_execucao: string | null
          data_servico: string | null
          data_vencimento: string | null
          descricao: string
          endereco_servico: string
          equipamento_tipo: Database["public"]["Enums"]["equipamento_tipo"]
          geocoded_at: string | null
          geocoding_status: string | null
          horario_previsto_inicio: string | null
          id: string
          latitude: number | null
          longitude: number | null
          numero_ticket: string
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["prioridade_tipo"]
          status: Database["public"]["Enums"]["ticket_status"]
          tecnico_responsavel_id: string | null
          tempo_estimado: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: string[] | null
          can_create_rme?: boolean | null
          cliente_id: string
          created_at?: string
          created_by: string
          data_abertura?: string
          data_conclusao?: string | null
          data_inicio_execucao?: string | null
          data_servico?: string | null
          data_vencimento?: string | null
          descricao: string
          endereco_servico: string
          equipamento_tipo: Database["public"]["Enums"]["equipamento_tipo"]
          geocoded_at?: string | null
          geocoding_status?: string | null
          horario_previsto_inicio?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero_ticket: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tipo"]
          status?: Database["public"]["Enums"]["ticket_status"]
          tecnico_responsavel_id?: string | null
          tempo_estimado?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: string[] | null
          can_create_rme?: boolean | null
          cliente_id?: string
          created_at?: string
          created_by?: string
          data_abertura?: string
          data_conclusao?: string | null
          data_inicio_execucao?: string | null
          data_servico?: string | null
          data_vencimento?: string | null
          descricao?: string
          endereco_servico?: string
          equipamento_tipo?: Database["public"]["Enums"]["equipamento_tipo"]
          geocoded_at?: string | null
          geocoding_status?: string | null
          horario_previsto_inicio?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero_ticket?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tipo"]
          status?: Database["public"]["Enums"]["ticket_status"]
          tecnico_responsavel_id?: string | null
          tempo_estimado?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tecnico_responsavel_id_fkey"
            columns: ["tecnico_responsavel_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_retry: { Args: { attempt: number }; Returns: string }
      can_tech_view_cliente: {
        Args: { p_cliente_id: string; p_user_id: string }
        Returns: boolean
      }
      check_geocoding_rate_limit: {
        Args: {
          p_ip: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_presence_rate_limit: {
        Args: { p_ip: string; p_os_id: string }
        Returns: boolean
      }
      check_schedule_conflict: {
        Args: {
          p_data: string
          p_hora_fim: string
          p_hora_inicio: string
          p_os_id?: string
          p_tecnico_id: string
        }
        Returns: boolean
      }
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_geocoding_cache: { Args: never; Returns: undefined }
      generate_presence_token: { Args: { p_os_id: string }; Returns: string }
      gerar_numero_os: { Args: never; Returns: string }
      gerar_numero_ticket: { Args: never; Returns: string }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_technician_workload: {
        Args: { p_end_date: string; p_start_date: string; p_tecnico_id: string }
        Returns: {
          data: string
          os_concluidas: number
          os_pendentes: number
          total_minutos: number
          total_os: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_safe: { Args: never; Returns: boolean }
      log_presence_attempt: {
        Args: { p_ip: string; p_os_id: string }
        Returns: undefined
      }
      mark_token_used: { Args: { p_token: string }; Returns: undefined }
      populate_rme_checklist: { Args: { p_rme_id: string }; Returns: undefined }
      validate_presence_token: {
        Args: { p_os_id: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "area_tecnica" | "tecnico_campo" | "cliente"
      equipamento_tipo:
        | "painel_solar"
        | "inversor"
        | "controlador_carga"
        | "bateria"
        | "cabeamento"
        | "estrutura"
        | "monitoramento"
        | "outros"
      prioridade_tipo: "baixa" | "media" | "alta" | "critica"
      ticket_status:
        | "aberto"
        | "aguardando_aprovacao"
        | "aprovado"
        | "rejeitado"
        | "ordem_servico_gerada"
        | "em_execucao"
        | "aguardando_rme"
        | "concluido"
        | "cancelado"
      user_role: "admin" | "tecnico_campo" | "area_tecnica" | "cliente"
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
      app_role: ["admin", "area_tecnica", "tecnico_campo", "cliente"],
      equipamento_tipo: [
        "painel_solar",
        "inversor",
        "controlador_carga",
        "bateria",
        "cabeamento",
        "estrutura",
        "monitoramento",
        "outros",
      ],
      prioridade_tipo: ["baixa", "media", "alta", "critica"],
      ticket_status: [
        "aberto",
        "aguardando_aprovacao",
        "aprovado",
        "rejeitado",
        "ordem_servico_gerada",
        "em_execucao",
        "aguardando_rme",
        "concluido",
        "cancelado",
      ],
      user_role: ["admin", "tecnico_campo", "area_tecnica", "cliente"],
    },
  },
} as const
