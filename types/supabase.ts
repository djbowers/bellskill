export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      feature_flag_assignments: {
        Row: {
          assigned_at: string
          flag_key: string
          user_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          flag_key: string
          user_id: string
          variant: string
        }
        Update: {
          assigned_at?: string
          flag_key?: string
          user_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_assignments_flag_key_fkey"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "feature_flag_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          default_variant: string
          description: string | null
          enabled: boolean
          key: string
          rollout_percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_variant?: string
          description?: string | null
          enabled?: boolean
          key: string
          rollout_percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_variant?: string
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      movement_logs: {
        Row: {
          created_at: string | null
          id: number
          movement_name: string
          rep_scheme: number[]
          timed_rungs: boolean
          user_id: string
          user_movement_id: string | null
          weight_one_unit: Database["public"]["Enums"]["weight_unit"] | null
          weight_one_value: number | null
          weight_two_unit: Database["public"]["Enums"]["weight_unit"] | null
          weight_two_value: number | null
          workout_log_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          movement_name: string
          rep_scheme?: number[]
          timed_rungs?: boolean
          user_id: string
          user_movement_id?: string | null
          weight_one_unit?: Database["public"]["Enums"]["weight_unit"] | null
          weight_one_value?: number | null
          weight_two_unit?: Database["public"]["Enums"]["weight_unit"] | null
          weight_two_value?: number | null
          workout_log_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          movement_name?: string
          rep_scheme?: number[]
          timed_rungs?: boolean
          user_id?: string
          user_movement_id?: string | null
          weight_one_unit?: Database["public"]["Enums"]["weight_unit"] | null
          weight_one_value?: number | null
          weight_two_unit?: Database["public"]["Enums"]["weight_unit"] | null
          weight_two_value?: number | null
          workout_log_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "movement_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "movement_logs_user_movement_id_fkey"
            columns: ["user_movement_id"]
            isOneToOne: false
            referencedRelation: "user_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_logs_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          "# Primary Items": number | null
          "Difficulty Level": string | null
          id: string
          Movement: string
          "Movement Pattern #1": string | null
          "Primary Equipment": string | null
          "Single or Double Arm": string | null
          "Target Muscle Group": string | null
        }
        Insert: {
          "# Primary Items"?: number | null
          "Difficulty Level"?: string | null
          id?: string
          Movement: string
          "Movement Pattern #1"?: string | null
          "Primary Equipment"?: string | null
          "Single or Double Arm"?: string | null
          "Target Muscle Group"?: string | null
        }
        Update: {
          "# Primary Items"?: number | null
          "Difficulty Level"?: string | null
          id?: string
          Movement?: string
          "Movement Pattern #1"?: string | null
          "Primary Equipment"?: string | null
          "Single or Double Arm"?: string | null
          "Target Muscle Group"?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          current_period_end: string | null
          full_name: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string
          training_goal: string | null
          trial_ends_at: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          current_period_end?: string | null
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          training_goal?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          current_period_end?: string | null
          full_name?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          training_goal?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      program_session_completions: {
        Row: {
          completed_at: string
          id: string
          program_session_id: string
          status: string
          user_id: string
          user_program_id: string
          workout_log_id: number | null
        }
        Insert: {
          completed_at?: string
          id?: string
          program_session_id: string
          status?: string
          user_id: string
          user_program_id: string
          workout_log_id?: number | null
        }
        Update: {
          completed_at?: string
          id?: string
          program_session_id?: string
          status?: string
          user_id?: string
          user_program_id?: string
          workout_log_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_session_completions_program_session_id_fkey"
            columns: ["program_session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_session_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "program_session_completions_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_session_completions_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions: {
        Row: {
          day_number: number
          id: string
          notes: string | null
          program_id: string
          sequence_index: number
          title: string
          week_number: number
          weight_label: string | null
          workout_options: Json
        }
        Insert: {
          day_number: number
          id?: string
          notes?: string | null
          program_id: string
          sequence_index: number
          title: string
          week_number: number
          weight_label?: string | null
          workout_options: Json
        }
        Update: {
          day_number?: number
          id?: string
          notes?: string | null
          program_id?: string
          sequence_index?: number
          title?: string
          week_number?: number
          weight_label?: string | null
          workout_options?: Json
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          archived_at: string | null
          author_name: string | null
          created_at: string
          days_per_week: number | null
          default_auto_repeat: boolean
          description: string | null
          id: string
          is_public: boolean
          num_weeks: number | null
          owner_id: string | null
          slug: string | null
          source_program_id: string | null
          title: string
        }
        Insert: {
          archived_at?: string | null
          author_name?: string | null
          created_at?: string
          days_per_week?: number | null
          default_auto_repeat?: boolean
          description?: string | null
          id?: string
          is_public?: boolean
          num_weeks?: number | null
          owner_id?: string | null
          slug?: string | null
          source_program_id?: string | null
          title: string
        }
        Update: {
          archived_at?: string | null
          author_name?: string | null
          created_at?: string
          days_per_week?: number | null
          default_auto_repeat?: boolean
          description?: string | null
          id?: string
          is_public?: boolean
          num_weeks?: number | null
          owner_id?: string | null
          slug?: string | null
          source_program_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "programs_source_program_id_fkey"
            columns: ["source_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_recommendations: {
        Row: {
          acted_at: string | null
          created_at: string
          error: string | null
          id: string
          inputs: Json
          output: Json | null
          status: string
          user_id: string
          workout_log_id: number | null
        }
        Insert: {
          acted_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          inputs: Json
          output?: Json | null
          status?: string
          user_id: string
          workout_log_id?: number | null
        }
        Update: {
          acted_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          inputs?: Json
          output?: Json | null
          status?: string
          user_id?: string
          workout_log_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_recommendations_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_movements: {
        Row: {
          canonical_name: string
          created_at: string | null
          functional_movement_id: string | null
          id: string
          is_big_6: boolean | null
          skill_tree_enabled: boolean | null
          user_id: string
        }
        Insert: {
          canonical_name: string
          created_at?: string | null
          functional_movement_id?: string | null
          id?: string
          is_big_6?: boolean | null
          skill_tree_enabled?: boolean | null
          user_id: string
        }
        Update: {
          canonical_name?: string
          created_at?: string | null
          functional_movement_id?: string | null
          id?: string
          is_big_6?: boolean | null
          skill_tree_enabled?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_movements_functional_movement_id_fkey"
            columns: ["functional_movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_movements_functional_movement_id_fkey"
            columns: ["functional_movement_id"]
            isOneToOne: false
            referencedRelation: "movements_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_programs: {
        Row: {
          active_slot: number | null
          auto_repeat: boolean
          completed_at: string | null
          config: Json
          cycles_completed: number
          id: string
          program_id: string
          queue_position: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          active_slot?: number | null
          auto_repeat?: boolean
          completed_at?: string | null
          config?: Json
          cycles_completed?: number
          id?: string
          program_id: string
          queue_position?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          active_slot?: number | null
          auto_repeat?: boolean
          completed_at?: string | null
          config?: Json
          cycles_completed?: number
          id?: string
          program_id?: string
          queue_position?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          bells: number[]
          completed_at: string
          completed_reps: number
          completed_rounds: number
          completed_rungs: number
          completed_sides: number | null
          completed_volume: number | null
          complex_set: boolean
          id: number
          interval_timer: number
          is_one_handed: boolean | null
          movements: string[]
          post_workout_notes: string | null
          pre_workout_notes: string | null
          rep_scheme: number[]
          rest_timer: number
          rpe: Database["public"]["Enums"]["RPE"] | null
          shared_weight_one_unit:
            | Database["public"]["Enums"]["weight_unit"]
            | null
          shared_weight_one_value: number | null
          shared_weight_two_unit:
            | Database["public"]["Enums"]["weight_unit"]
            | null
          shared_weight_two_value: number | null
          started_at: string
          straight_sets: boolean
          title: string | null
          unit: string | null
          user_id: string
          workout_goal: number
          workout_goal_units: Database["public"]["Enums"]["workout_goal_units"]
        }
        Insert: {
          bells?: number[]
          completed_at?: string
          completed_reps: number
          completed_rounds: number
          completed_rungs: number
          completed_sides?: number | null
          completed_volume?: number | null
          complex_set?: boolean
          id?: number
          interval_timer?: number
          is_one_handed?: boolean | null
          movements: string[]
          post_workout_notes?: string | null
          pre_workout_notes?: string | null
          rep_scheme?: number[]
          rest_timer?: number
          rpe?: Database["public"]["Enums"]["RPE"] | null
          shared_weight_one_unit?:
            | Database["public"]["Enums"]["weight_unit"]
            | null
          shared_weight_one_value?: number | null
          shared_weight_two_unit?:
            | Database["public"]["Enums"]["weight_unit"]
            | null
          shared_weight_two_value?: number | null
          started_at: string
          straight_sets?: boolean
          title?: string | null
          unit?: string | null
          user_id: string
          workout_goal: number
          workout_goal_units?: Database["public"]["Enums"]["workout_goal_units"]
        }
        Update: {
          bells?: number[]
          completed_at?: string
          completed_reps?: number
          completed_rounds?: number
          completed_rungs?: number
          completed_sides?: number | null
          completed_volume?: number | null
          complex_set?: boolean
          id?: number
          interval_timer?: number
          is_one_handed?: boolean | null
          movements?: string[]
          post_workout_notes?: string | null
          pre_workout_notes?: string | null
          rep_scheme?: number[]
          rest_timer?: number
          rpe?: Database["public"]["Enums"]["RPE"] | null
          shared_weight_one_unit?:
            | Database["public"]["Enums"]["weight_unit"]
            | null
          shared_weight_one_value?: number | null
          shared_weight_two_unit?:
            | Database["public"]["Enums"]["weight_unit"]
            | null
          shared_weight_two_value?: number | null
          started_at?: string
          straight_sets?: boolean
          title?: string | null
          unit?: string | null
          user_id?: string
          workout_goal?: number
          workout_goal_units?: Database["public"]["Enums"]["workout_goal_units"]
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activation"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      activation_funnel_summary: {
        Row: {
          activated_24h_count: number | null
          activated_24h_rate: number | null
          activated_north_star_count: number | null
          activated_north_star_rate: number | null
          avg_seconds_to_first_workout: number | null
          median_seconds_to_first_workout: number | null
          signup_to_first_workout_rate: number | null
          total_signups: number | null
          users_with_first_workout: number | null
        }
        Relationships: []
      }
      movements_catalog: {
        Row: {
          id: string | null
          name: string | null
          primary_equipment: string | null
          primary_item_count: number | null
          single_or_double_arm: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          primary_equipment?: string | null
          primary_item_count?: number | null
          single_or_double_arm?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          primary_equipment?: string | null
          primary_item_count?: number | null
          single_or_double_arm?: string | null
        }
        Relationships: []
      }
      user_activation: {
        Row: {
          activated_24h: boolean | null
          activated_north_star: boolean | null
          first_workout_at: string | null
          seconds_to_first_workout: number | null
          signup_at: string | null
          user_id: string | null
          workouts_within_14d: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activation_funnel_by_variant: {
        Args: {
          p_flag_key: string
          p_signup_from?: string
          p_signup_to?: string
        }
        Returns: {
          activated_24h_count: number
          activated_24h_rate: number
          activated_north_star_count: number
          activated_north_star_rate: number
          avg_seconds_to_first_workout: number
          mature_signups: number
          median_seconds_to_first_workout: number
          signup_to_first_workout_rate: number
          total_signups: number
          users_with_first_workout: number
          variant: string
        }[]
      }
      activation_funnel_window: {
        Args: { p_signup_from?: string; p_signup_to?: string }
        Returns: {
          activated_24h_count: number
          activated_24h_rate: number
          activated_north_star_count: number
          activated_north_star_rate: number
          avg_seconds_to_first_workout: number
          mature_signups: number
          median_seconds_to_first_workout: number
          signup_from: string
          signup_to: string
          signup_to_first_workout_rate: number
          total_signups: number
          users_with_first_workout: number
        }[]
      }
      complete_program_session: {
        Args: {
          p_program_session_id: string
          p_status?: string
          p_user_program_id: string
          p_workout_log_id?: number
        }
        Returns: boolean
      }
      delete_program_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      enroll_in_program: {
        Args: {
          p_auto_repeat?: boolean
          p_movement_weights?: Json
          p_program_id: string
          p_queue?: boolean
          p_replace_user_program_id?: string
          p_shared_weight_one_unit?: string
          p_shared_weight_one_value?: number
          p_shared_weight_two_unit?: string
          p_shared_weight_two_value?: number
        }
        Returns: string
      }
      evaluate_feature_flag: { Args: { p_flag_key: string }; Returns: string }
      evaluate_feature_flags: {
        Args: { p_flag_keys: string[] }
        Returns: {
          flag_key: string
          variant: string
        }[]
      }
      has_premium_access: { Args: { user_id: string }; Returns: boolean }
      pattern_debt_window: {
        Args: { p_baseline_days?: number; p_window_days?: number }
        Returns: {
          baseline_volume_kg: number
          hardest_rpe: Database["public"]["Enums"]["RPE"]
          last_trained_at: string
          pattern: string
          set_count: number
          total_reps: number
          total_volume_kg: number
        }[]
      }
      reorder_program_sessions: {
        Args: { p_ordered_ids: string[]; p_program_id: string }
        Returns: undefined
      }
      resume_program: {
        Args: { p_replace_user_program_id?: string; p_user_program_id: string }
        Returns: string
      }
      update_program_sessions_forward: {
        Args: { p_forward_options: Json; p_session_id: string }
        Returns: number
      }
    }
    Enums: {
      RPE: "noEffort" | "easy" | "ideal" | "hard" | "maxEffort"
      weight_unit: "kilograms" | "pounds"
      workout_goal_units: "minutes" | "rounds" | "kilograms"
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
      RPE: ["noEffort", "easy", "ideal", "hard", "maxEffort"],
      weight_unit: ["kilograms", "pounds"],
      workout_goal_units: ["minutes", "rounds", "kilograms"],
    },
  },
} as const

