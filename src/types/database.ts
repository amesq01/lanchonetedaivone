export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'admin' | 'atendente' | 'cozinha';
          codigo: string | null;
          nome: string;
          email: string;
          telefone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      config: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: { key: string; value: Json; updated_at?: string };
        Update: { key?: string; value?: Json; updated_at?: string };
      };
      mesas: {
        Row: {
          id: string;
          numero: number;
          nome: string;
          is_viagem: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['mesas']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mesas']['Insert']>;
      };
      comandas: {
        Row: {
          id: string;
          mesa_id: string;
          atendente_id: string;
          nome_cliente: string;
          aberta: boolean;
          forma_pagamento: string | null;
          encerrada_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comandas']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['comandas']['Insert']>;
      };
      produtos: {
        Row: {
          id: string;
          codigo: string;
          descricao: string;
          acompanhamentos: string | null;
          valor: number;
          quantidade: number;
          ativo: boolean;
          imagem_url: string | null;
          vai_para_cozinha: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['produtos']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['produtos']['Insert']>;
      };
      cupons: {
        Row: {
          id: string;
          codigo: string;
          porcentagem: number;
          valido_ate: string;
          quantidade_usos: number;
          usos_restantes: number;
          ativo: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cupons']['Row'], 'created_at'> & { created_at?: string };
        Update: Partial<Database['public']['Tables']['cupons']['Insert']>;
      };
      pedidos: {
        Row: {
          id: string;
          numero: number;
          comanda_id: string | null;
          origem: 'presencial' | 'viagem' | 'online';
          status: 'aguardando_aceite' | 'novo_pedido' | 'em_preparacao' | 'finalizado' | 'cancelado';
          cliente_nome: string | null;
          cliente_whatsapp: string | null;
          cliente_endereco: string | null;
          forma_pagamento: string | null;
          troco_para: number | null;
          observacoes: string | null;
          cupom_id: string | null;
          desconto: number;
          taxa_entrega: number;
          encerrado_em: string | null;
          motivo_cancelamento: string | null;
          cancelado_por: string | null;
          cancelado_em: string | null;
          tipo_entrega: 'entrega' | 'retirada' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['pedidos']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['pedidos']['Insert']>;
      };
      pedido_itens: {
        Row: {
          id: string;
          pedido_id: string;
          produto_id: string;
          quantidade: number;
          valor_unitario: number;
          observacao: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['pedido_itens']['Row'], 'created_at'> & { created_at?: string };
        Update: Partial<Database['public']['Tables']['pedido_itens']['Insert']>;
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Mesa = Database['public']['Tables']['mesas']['Row'];
export type Comanda = Database['public']['Tables']['comandas']['Row'];
export type Produto = Database['public']['Tables']['produtos']['Row'];
export type Cupom = Database['public']['Tables']['cupons']['Row'];
export type Pedido = Database['public']['Tables']['pedidos']['Row'];
export type PedidoItem = Database['public']['Tables']['pedido_itens']['Row'];

export type PedidoWithItens = Pedido & {
  pedido_itens: (PedidoItem & { produtos: Produto | null })[];
};
