import EventLoading from "@/components/events/EventLoading";

export default function Loading() {
  return <EventLoading label="Loading event research" detail="Reading the case files, the forecast and thesis ledgers, and the market snapshot. Everything on these pages is computed from committed data; nothing is fetched live." />;
}
