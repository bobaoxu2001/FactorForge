import EventLoading from "@/components/events/EventLoading";

export default function Loading() {
  return <EventLoading compact label="Loading this section" detail="Claims, measurements and ledgers for this case are precomputed; only the page itself is on its way." />;
}
