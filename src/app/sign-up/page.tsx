import AuthForm from "@/components/auth/AuthForm";
import DemoModeNotice from "@/components/auth/DemoModeNotice";
import { signUpAction } from "@/lib/auth/actions";
import { isPersistenceAvailable } from "@/lib/persistence/db";

export const dynamic = "force-dynamic";

export default function SignUpPage({
  searchParams,
}: {
  searchParams?: { next?: string; area?: string };
}) {
  // No writable database (e.g. the public Vercel demo) → account creation can't
  // work. Show an honest demo-mode notice instead of letting the form submit
  // into a "Persistence layer unavailable" error.
  if (!isPersistenceAvailable()) {
    return <DemoModeNotice mode="sign-up" area={searchParams?.area} />;
  }
  return <AuthForm mode="sign-up" action={signUpAction} nextPath={searchParams?.next} protectedArea={searchParams?.area} />;
}
