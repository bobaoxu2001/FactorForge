import AuthForm from "@/components/auth/AuthForm";
import { signUpAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default function SignUpPage({
  searchParams,
}: {
  searchParams?: { next?: string; area?: string };
}) {
  return <AuthForm mode="sign-up" action={signUpAction} nextPath={searchParams?.next} protectedArea={searchParams?.area} />;
}
