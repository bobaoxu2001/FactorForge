import AuthForm from "@/components/auth/AuthForm";
import DemoModeNotice from "@/components/auth/DemoModeNotice";
import { signInAction } from "@/lib/auth/actions";
import { isPersistenceAvailable } from "@/lib/persistence/db";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; area?: string };
}) {
  // Without a writable database there are no accounts to sign in to. Protected
  // routes redirect here with an `area`, so the notice also explains why that
  // page is gated in the public demo.
  if (!isPersistenceAvailable()) {
    return <DemoModeNotice mode="sign-in" area={searchParams?.area} />;
  }
  return <AuthForm mode="sign-in" action={signInAction} nextPath={searchParams?.next} protectedArea={searchParams?.area} />;
}
