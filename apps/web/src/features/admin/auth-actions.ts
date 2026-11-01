"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { blocked, clientIp, hit, TOO_MANY } from "@/lib/security/rate-limit";
import { ADMIN_COOKIE, checkPassword, issueSessionValue } from "./session";

export async function login(_prev: { error: string } | null, form: FormData) {
  // 무차별 대입 방지: 실패한 시도만 IP당 10분에 5회까지 + 매 시도 지연
  const key = `admin-login-fail:${await clientIp()}`;
  if (blocked(key, 5)) return { error: TOO_MANY };
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPassword(String(form.get("password") ?? ""))) {
    hit(key, 5, 10 * 60_000);
    return { error: "비밀번호가 맞지 않아요" };
  }
  const { value, maxAge } = issueSessionValue();
  (await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
