import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignupConfirmPage() {
  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
      <p className="text-sm text-muted-foreground">
        You should receive an email shortly. Click the link in that email to activate your account.
      </p>
      <Button asChild className="w-full">
        <Link href="/login">Back to log in</Link>
      </Button>
    </div>
  );
}
