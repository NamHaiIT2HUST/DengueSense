import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toUserFacing } from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/TextField";

import { login } from "./api";
import { safeRedirect } from "./safeRedirect";

const schema = z.object({
  username: z.string().trim().min(1, vi.auth.required).max(128, vi.auth.tooLong),
  password: z.string().min(1, vi.auth.required).max(256, vi.auth.tooLong),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage({ redirect }: { redirect?: string | undefined }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setFormError(null);
    try {
      await login(username, password);
    } catch (err) {
      // Sai tên/mật khẩu và tài khoản khoá đều là lỗi CHUNG của form (không gắn vào một trường để không gợi ý trường nào sai).
      setFormError(toUserFacing(err).message);
      return;
    }
    router.history.push(safeRedirect(redirect));
  });

  const isDemo = env.VITE_APP_MODE === "demo";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="font-display text-3xl font-semibold">{vi.auth.title}</h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">{vi.auth.subtitle}</p>
      </div>

      {isDemo ? (
        <Alert tone="info">
          <p>{vi.auth.demoBanner}</p>
          <p className="mt-2 font-medium">{vi.auth.demoAccounts}:</p>
          <ul className="mt-1 space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username} className="flex items-center justify-between gap-3">
                <span>
                  <code>{a.username}</code> / <code>{a.password}</code>
                </span>
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  onClick={() => {
                    setValue("username", a.username);
                    setValue("password", a.password);
                  }}
                >
                  {vi.auth.fillDemo}
                </Button>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={vi.auth.title}>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <TextField
          label={vi.auth.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.username?.message}
          {...register("username")}
        />
        <TextField
          label={vi.auth.password}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? vi.auth.submitting : vi.auth.submit}
        </Button>
      </form>

      <Link
        to="/"
        className="text-center text-sm text-[var(--ink-muted)] underline hover:text-[var(--ink-primary)]"
      >
        {vi.auth.backToLanding}
      </Link>
    </main>
  );
}
