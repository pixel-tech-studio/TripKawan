import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface GeneratedItem {
  day_date: string;
  title: string;
  category: string;
  notes?: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = await createClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load trip
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .single();

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  if (!trip.start_date || !trip.end_date) {
    return NextResponse.json(
      { error: "Trip needs start and end dates to generate an itinerary" },
      { status: 400 }
    );
  }

  // Load preferences
  const { data: prefs } = await supabase
    .from("trip_preferences")
    .select("*")
    .eq("trip_id", tripId)
    .single();

  if (!prefs) {
    return NextResponse.json(
      { error: "No preferences found. Complete the questionnaire first." },
      { status: 400 }
    );
  }

  // Calculate trip days — use local date formatting to avoid UTC timezone shift
  const start = new Date(trip.start_date + "T00:00:00");
  const end = new Date(trip.end_date + "T00:00:00");
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }

  const numDays = days.length;
  const interestsText = prefs.activity_interests?.join(", ") || "general sightseeing";

  const prompt = `You are a knowledgeable travel planner helping a group plan a trip.

Trip details:
- Destination: ${trip.destination || "the destination"}
- Duration: ${numDays} day${numDays > 1 ? "s" : ""} (${trip.start_date} to ${trip.end_date})
- Group size: ${trip.expected_pax} people
- Travel style: ${prefs.travel_style}
- Accommodation: ${prefs.accommodation}
- Dining preference: ${prefs.dining}
- Activity interests: ${interestsText}
- Budget level: ${prefs.budget}
${prefs.special_notes ? `- Special notes: ${prefs.special_notes}` : ""}

Generate a practical day-by-day itinerary. For each day, suggest:
- 1 morning activity
- 1 lunch spot or food recommendation
- 1 afternoon activity
- 1 dinner spot or food recommendation

Rules:
- Use real, well-known places relevant to ${trip.destination || "the destination"} where possible
- Keep suggestions appropriate for a group of ${trip.expected_pax} people
- Match the ${prefs.budget} budget level and ${prefs.travel_style} vibe
- For dining, suggest ${prefs.dining === "mix" ? "a mix of dining options" : prefs.dining.replace("_", " ")}
- Each title should be concise (under 60 characters), e.g. "Breakfast at Jalan Alor night market"

Return ONLY a valid JSON array (no markdown, no explanation) with this exact shape:
[
  {
    "day_date": "YYYY-MM-DD",
    "title": "Short activity or place title",
    "category": "morning|lunch|afternoon|dinner"
  }
]

Day dates to use: ${days.join(", ")}`;

  let generated: GeneratedItem[] = [];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You are a travel planner. Respond only with valid JSON arrays. No markdown code blocks, no explanation.",
        },
        { role: "user", content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content || "";

    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    generated = JSON.parse(cleaned);

    if (!Array.isArray(generated)) {
      throw new Error("Response was not an array");
    }
  } catch (err) {
    console.error("AI generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate itinerary. Please try again." },
      { status: 500 }
    );
  }

  // Delete previous AI-generated items for this trip before inserting new ones
  await supabase
    .from("itinerary_items")
    .delete()
    .eq("trip_id", tripId)
    .eq("source", "ai");

  // Insert new items
  const itemsToInsert = generated
    .filter(
      (item) =>
        item.day_date &&
        item.title &&
        days.includes(item.day_date)
    )
    .map((item) => ({
      trip_id: tripId,
      day_date: item.day_date,
      title: item.title,
      url: `https://www.google.com/maps/search/${encodeURIComponent(`${item.title} ${trip.destination || ""}`)}`,
      suggested_by: user.id,
      status: "suggested" as const,
      source: "ai",
    }));

  if (itemsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("itinerary_items")
      .insert(itemsToInsert);

    if (insertError) {
      console.error("Insert failed:", insertError);
      return NextResponse.json(
        { error: `Failed to save itinerary: ${insertError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ count: itemsToInsert.length });
}
