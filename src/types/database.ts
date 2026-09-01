// Hand-authored types mirroring supabase/migrations/*.sql.
// Regenerate with `supabase gen types typescript` once a live project exists
// and keep this file as the fallback / diff-check.

/** Internal STAGE markers — logical order: ask → know system → narrow →
 *  targeted check → conclusion → confirm test → (repeat check/conclude/test)
 *  → verify_fix after repair. Wire names kept for DB compatibility. */
export type DiagnosticStage =
  | 'verify' // ask the operator
  | 'theory' // know the system (honesty-gated)
  | 'narrow' // probable causes
  | 'inspect' // targeted check
  | 'diagnosis' // reach a conclusion
  | 'test' // test the conclusion
  | 'verify_fix'

export type AppMode = 'repair' | 'pre_purchase' | 'routine'

export type SafeToOperate = 'yes' | 'no' | 'caution' | 'unknown'
export type Confidence = 'high' | 'medium' | 'low'
export type DiagnosisOutcome = 'pending' | 'fixed' | 'not_fixed' | 'no_fault_found'
export type FailureType = 'ruled_out' | 'process_error'
export type ManualExtractionStatus = 'pending' | 'ok' | 'empty_scanned_pdf' | 'error'

// NOTE: these are `type` aliases, not `interface`s, on purpose. TypeScript
// only infers an implicit index signature for object-literal `type`s —
// `interface` declarations never get one — and the Supabase client's
// generics require every Row/Insert/Update shape to structurally satisfy
// `Record<string, unknown>`. Using `interface` here silently breaks
// `.from(...).insert(...)` type inference (falls back to `never`).

export type RankedCause = {
  cause: string
  likelihood: 'high' | 'medium' | 'low'
  confidence?: number
  reasoning?: string
}

export type DifferentialEntry = {
  cause: string
  confidence: number
  rationale?: string
}

export type LikelyPart = {
  name: string
  part_number?: string
}

export type Machine = {
  id: string
  user_id: string
  name: string
  make: string
  model: string
  serial_number: string | null
  hours: number | null
  created_at: string
  updated_at: string
}

export type Conversation = {
  id: string
  machine_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  stage: DiagnosticStage | null
  mode: AppMode
  photo_paths: string[]
  differential: DifferentialEntry[] | null
  created_at: string
}

export type Diagnosis = {
  id: string
  machine_id: string
  user_id: string
  conversation_id: string | null
  tag_number: string
  summary: string
  safe_to_operate: SafeToOperate
  confidence: Confidence
  ranked_causes: RankedCause[]
  likely_parts: LikelyPart[]
  repair_steps: string[]
  verification_steps: string[]
  outcome: DiagnosisOutcome
  created_at: string
  resolved_at: string | null
}

export type Manual = {
  id: string
  machine_id: string
  user_id: string
  filename: string
  storage_path: string
  extracted_text: string | null
  extraction_status: ManualExtractionStatus
  uploaded_at: string
}

export type SpnCode = {
  spn: number
  make: string | null
  name: string
  system: string
  description: string | null
}

export type FmiCode = {
  fmi: number
  description: string
  severity_hint: string | null
}

export type Repair = {
  id: string
  machine_id: string
  user_id: string
  diagnosis_id: string | null
  parts_replaced: LikelyPart[]
  verified_fix: boolean | null
  failure_type: FailureType | null
  notes: string | null
  verified_at: string | null
  created_at: string
}

export type CasePrecedent = {
  id: string
  user_id: string
  source_machine_id: string | null
  make: string
  model: string
  hours_range: string | null
  system: string
  symptom_summary: string
  root_cause: string
  confirming_test: string | null
  fix_applied: string | null
  verified_outcome: boolean
  created_at: string
}

export type Profile = {
  id: string
  is_subscribed: boolean
  subscription_tier: 'free' | 'basic' | 'pro' | 'premium'
  stripe_customer_id: string | null
  gus_messages_used: number
  gus_messages_period_start: string
  created_at: string
}

export type CommonIssuesCache = {
  id: string
  make: string
  model: string
  symptom_keywords: string
  search_results_summary: string
  source_urls: string[]
  cached_at: string
}

// Minimal Supabase `Database` shape — enough for the typed client to work
// without pulling in the full generated-types machinery yet. Each table
// needs `Relationships` (even if empty) and the schema needs `Views` /
// `Functions` because @supabase/postgrest-js's generics fall back to `never`
// without them.
type NoRelationships = { Relationships: [] }

export type Database = {
  public: {
    Tables: {
      machines: {
        Row: Machine
        Insert: Partial<Machine> & Pick<Machine, 'name' | 'make' | 'model' | 'user_id'>
        Update: Partial<Machine>
      } & NoRelationships
      conversations: {
        Row: Conversation
        Insert: Partial<Conversation> & Pick<Conversation, 'machine_id' | 'user_id' | 'role' | 'content'>
        Update: Partial<Conversation>
      } & NoRelationships
      diagnoses: {
        Row: Diagnosis
        Insert: Partial<Diagnosis> &
          Pick<Diagnosis, 'machine_id' | 'user_id' | 'summary' | 'safe_to_operate' | 'confidence'>
        Update: Partial<Diagnosis>
      } & NoRelationships
      manuals: {
        Row: Manual
        Insert: Partial<Manual> & Pick<Manual, 'machine_id' | 'user_id' | 'filename' | 'storage_path'>
        Update: Partial<Manual>
      } & NoRelationships
      spn_codes: { Row: SpnCode; Insert: SpnCode; Update: Partial<SpnCode> } & NoRelationships
      fmi_codes: { Row: FmiCode; Insert: FmiCode; Update: Partial<FmiCode> } & NoRelationships
      repairs: {
        Row: Repair
        Insert: Partial<Repair> & Pick<Repair, 'machine_id' | 'user_id'>
        Update: Partial<Repair>
      } & NoRelationships
      case_precedents: {
        Row: CasePrecedent
        Insert: Partial<CasePrecedent> &
          Pick<CasePrecedent, 'user_id' | 'make' | 'model' | 'system' | 'symptom_summary' | 'root_cause' | 'verified_outcome'>
        Update: Partial<CasePrecedent>
      } & NoRelationships
      common_issues_cache: {
        Row: CommonIssuesCache
        Insert: Partial<CommonIssuesCache> &
          Pick<CommonIssuesCache, 'make' | 'model' | 'symptom_keywords' | 'search_results_summary'>
        Update: Partial<CommonIssuesCache>
      } & NoRelationships
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'id'>
        Update: Partial<Profile>
      } & NoRelationships
    }
    Views: Record<string, never>
    Functions: {
      delete_own_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      try_consume_gus_message: {
        Args: { p_limit: number }
        Returns: {
          allowed: boolean
          messages_used: number
          messages_limit: number | null
          is_subscribed: boolean
          subscription_tier: string
          reason?: string
        }
      }
    }
  }
}
