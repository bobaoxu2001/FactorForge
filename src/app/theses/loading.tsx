import EventLoading from "@/components/events/EventLoading";

export default function Loading() {
  return <EventLoading label="Loading theses" detail="Replaying each thesis against the evidence available at every checkpoint, from the committed thesis ledger." />;
}
