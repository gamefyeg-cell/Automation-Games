/**
 * Hand-written types matching supabase/migrations/20260827124014_init_schema.sql.
 *
 * Once this project is linked to a real Supabase project, regenerate this
 * file from the live schema instead of hand-editing it:
 *
 *   npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          steam_app_id: number;
          name: string;
          slug: string;
          description: string | null;
          developer: string | null;
          publisher: string | null;
          genres: string[];
          image_url: string | null;
          steam_url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          steam_app_id: number;
          name: string;
          slug: string;
          description?: string | null;
          developer?: string | null;
          publisher?: string | null;
          genres?: string[];
          image_url?: string | null;
          steam_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Insert"]>;
        Relationships: [];
      };
      game_regions: {
        Row: {
          id: string;
          game_id: string;
          country_code: string;
          currency: string;
          original_price: number;
          current_price: number;
          discount_percent: number;
          sale_active: boolean;
          sale_end: string | null;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          country_code: string;
          currency: string;
          original_price: number;
          current_price: number;
          discount_percent?: number;
          sale_active?: boolean;
          sale_end?: string | null;
          last_updated?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["game_regions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "game_regions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      game_price_history: {
        Row: {
          id: string;
          game_id: string;
          country_code: string;
          currency: string;
          original_price: number;
          current_price: number;
          discount_percent: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          country_code: string;
          currency: string;
          original_price: number;
          current_price: number;
          discount_percent?: number;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["game_price_history"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "game_price_history_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_cards: {
        Row: {
          id: string;
          provider: string;
          product_name: string;
          value: number;
          value_currency: string;
          region: string | null;
          purchase_price: number;
          fees: number;
          purchase_currency: string;
          total_cost: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          product_name: string;
          value: number;
          value_currency: string;
          region?: string | null;
          purchase_price: number;
          fees?: number;
          purchase_currency?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_cards"]["Insert"]>;
        Relationships: [];
      };
      pricing_settings: {
        Row: {
          id: true;
          minimum_profit: number;
          target_profit_percentage: number;
          payment_fee_percentage: number;
          website_fee_percentage: number;
          default_currency: string;
          updated_at: string;
        };
        Insert: {
          id?: true;
          minimum_profit?: number;
          target_profit_percentage?: number;
          payment_fee_percentage?: number;
          website_fee_percentage?: number;
          default_currency?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_settings"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          game_id: string;
          game_region_id: string | null;
          title: string;
          description: string | null;
          image_url: string | null;
          selling_price: number;
          old_price: number | null;
          cost: number;
          profit: number;
          profit_margin: number;
          currency: string;
          stock: number | null;
          published: boolean;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          game_region_id?: string | null;
          title: string;
          description?: string | null;
          image_url?: string | null;
          selling_price: number;
          old_price?: number | null;
          cost?: number;
          currency?: string;
          stock?: number | null;
          published?: boolean;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_game_region_id_fkey";
            columns: ["game_region_id"];
            isOneToOne: false;
            referencedRelation: "game_regions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
