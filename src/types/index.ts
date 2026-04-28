export interface Business {
  id: string
  user_id: string
  name: string
  google_place_id?: string | null
  category?: string | null
  logo_url?: string | null
  welcome_message?: string | null
  description?: string | null
  city?: string | null
  area?: string | null
  created_at: string
}

export interface HighlightTag {
  id: string
  business_id: string
  category: string
  label: string
  sort_order: number
}

export interface MenuItem {
  id: string
  business_id: string
  name: string
  sort_order: number
}

export interface ReviewSession {
  id: string
  business_id: string
  overall_rating?: number | null
  category_ratings?: Record<string, number> | null
  selected_tags?: string[] | null
  additional_comment?: string | null
  generated_review?: string | null
  status: string
  customer_contact?: string | null
  private_feedback?: string | null
  created_at: string
}
