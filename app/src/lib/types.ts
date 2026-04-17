export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  duitnow_qr_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  expected_pax: number;
  start_date: string | null;
  end_date: string | null;
  photo_album_url: string | null;
  created_at: string;
}

export interface TripPreferences {
  id: string;
  trip_id: string;
  travel_style: string;
  accommodation: string;
  dining: string;
  activity_interests: string[];
  budget: string;
  special_notes: string | null;
  created_at: string;
}

export type TripMemberRole = "admin" | "member";

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  joined_at: string;
  role: TripMemberRole;
}

export type ItineraryStatus = "suggested" | "confirmed";

export interface ItineraryItem {
  id: string;
  trip_id: string;
  day_date: string | null;
  title: string;
  url: string | null;
  image_url: string | null;
  suggested_by: string;
  status: ItineraryStatus;
  source: string;
  created_at: string;
}

export interface Attachment {
  url: string;
  name: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  item_name: string;
  amount: number;
  receipt_url: string | null;
  attachments: Attachment[];
  created_at: string;
}

// Joined types for UI
export interface ExpenseWithProfile extends Expense {
  profiles: Pick<Profile, "display_name" | "avatar_url">;
}

export interface ItineraryItemWithProfile extends ItineraryItem {
  profiles: Pick<Profile, "display_name">;
}

export interface TripWithMemberCount extends Trip {
  member_count: number;
}
