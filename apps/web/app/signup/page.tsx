import { AuthLayout } from "../../components/auth/auth-layout";
import { SignUpForm } from "../../components/auth/signup-form";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
