import type { Metadata } from "next";
import RoomView from "@/components/rooms/RoomView";
import { requirePageUserId } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Listening room", robots: { index: false } };

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  await requirePageUserId(`/rooms/${id}`);
  return <div className="mx-auto max-w-3xl"><RoomView id={id} /></div>;
}
