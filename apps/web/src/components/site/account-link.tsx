import Link from "next/link";
import { currentUser } from "@/features/account/session";
import { MobileMenu } from "./mobile-menu";

const cls = "hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-white/70 hover:text-ink md:inline";

/** 우측 상단: 로그인 전엔 "로그인", 로그인하면 "마이페이지". 휴대폰은 햄버거 메뉴 안에. */
export async function AccountLink() {
  const me = await currentUser();
  return (
    <>
      {me ? <Link href="/account" className={cls}>마이페이지</Link> : <Link href="/login" className={cls}>로그인</Link>}
      <MobileMenu signedIn={!!me} />
    </>
  );
}

/** 쿠키를 읽는 동안 자리만 잡아 둔다 */
export function AccountLinkFallback() {
  return <span className={`${cls} invisible`} aria-hidden>로그인</span>;
}
