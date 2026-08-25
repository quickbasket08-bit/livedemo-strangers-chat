import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";
import VideoChatRoom from "@/components/VideoChatRoom";

export default async function VideoChatPage({
  params,
}: {
  params: { roomId: string };
}) {
  const session = getSession();
  if (!session) {
    redirect("/");
  }

  const supabase = supabaseServer();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, mode, user1_id, user1_name, user2_id, user2_name, ended_at")
    .eq("id", params.roomId)
    .single();

  if (!room || room.mode !== "video") {
    redirect("/mode");
  }
  if (room.user1_id !== session!.sessionId && room.user2_id !== session!.sessionId) {
    redirect("/mode");
  }

  const partnerName = room.user1_id === session!.sessionId ? room.user2_name : room.user1_name;

  return <VideoChatRoom roomId={room.id} partnerName={partnerName} />;
}
