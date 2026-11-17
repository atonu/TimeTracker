"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { newRoomId, ROOM_ID_RE } from "@/lib/room";
import { IMPORT_KEY, LAST_ROOM_KEY } from "@/lib/useTracker";

export default function RoomRedirect() {
  const router = useRouter();

  useEffect(() => {
    let id = "";
    try {
      id = localStorage.getItem(LAST_ROOM_KEY) || "";
      if (!ROOM_ID_RE.test(id)) {
        id = newRoomId();
        localStorage.setItem(LAST_ROOM_KEY, id);
        // Data saved in this browser before rooms existed moves into the first room.
        if (localStorage.getItem("timetracker:v1")) localStorage.setItem(IMPORT_KEY, id);
      }
    } catch {
      id = newRoomId();
    }
    router.replace(`/${id}`);
  }, [router]);

  return <noscript>Tickwell needs JavaScript to open your room.</noscript>;
}
