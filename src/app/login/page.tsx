"use client";

import { supabase } from "@/lib/supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4 text-center">Sign in</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          view="magic_link"
          showLinks={false}
          redirectTo={
            typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined
          }
        />
        <p className="text-xs text-gray-500 mt-4 text-center">
          We’ll email you a one-time magic link to sign in.
        </p>
      </div>
    </div>
  );
}
