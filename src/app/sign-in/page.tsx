import AuthForm from "@/components/auth/AuthForm";
import { signInAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; area?: string };
}) {
  return <AuthForm mode="sign-in" action={signInAction} nextPath={searchParams?.next} protectedArea={searchParams?.area} />;
}
