import AuthForm from "@/components/auth/AuthForm";
import { signInAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <AuthForm mode="sign-in" action={signInAction} />;
}
