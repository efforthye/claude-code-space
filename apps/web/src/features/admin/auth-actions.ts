"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, checkPassword, issueSessionValue } from "./session";

export async function login(_prev: { error: string } | null, form: FormData) {
  // 무차별 대입을 늦추는 최소한의 지연. 정식 오픈 전에는 시도 횟수 제한을 붙인다.
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "비밀번호가 맞지 않아요" };
  const { value, maxAge } = issueSessionValue();
  (await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
