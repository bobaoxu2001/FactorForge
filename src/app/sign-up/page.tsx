import AuthForm from "@/components/auth/AuthForm";
import { signUpAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return <AuthForm mode="sign-up" action={signUpAction} />;
}
