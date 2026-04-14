import { createClient } from "@/lib/supabase/server";
import SetAlbumLink from "./SetAlbumLink";

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trip } = await supabase
    .from("trips")
    .select("admin_user_id, photo_album_url")
    .eq("id", tripId)
    .single();

  const isAdmin = user?.id === trip?.admin_user_id;
  const albumUrl = trip?.photo_album_url;

  return (
    <div className="px-4 py-4">
      {albumUrl ? (
        <div className="space-y-4">
          <a
            href={albumUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-6 text-white text-center shadow-card hover:shadow-lg transition-shadow"
          >
            <span className="text-4xl block mb-3">📸</span>
            <p className="text-sm font-semibold">Open Shared Album</p>
            <p className="text-xs opacity-70 mt-1">View & add photos on Google Photos</p>
          </a>

          {isAdmin && (
            <SetAlbumLink tripId={tripId} currentUrl={albumUrl} />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📷</span>
          {isAdmin ? (
            <>
              <p className="text-gray-400 text-sm mb-6">
                Paste your Google Photos shared album link
                <br />
                so everyone can view trip photos.
              </p>
              <SetAlbumLink tripId={tripId} currentUrl="" />
            </>
          ) : (
            <p className="text-gray-400 text-sm">
              No photo album linked yet.
              <br />
              Ask the trip admin to add one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
