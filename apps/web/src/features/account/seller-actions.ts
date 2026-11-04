"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TAG } from "@/lib/data/catalog";
import { READONLY_MESSAGE, store, STORE_READONLY } from "@/lib/data/store";
import { deletePrivate, savePrivateImage, UploadError } from "@/lib/data/uploads";
import { ArtistWorkInput, MediaList, MediaSrc, parseJson, StoryList } from "@/lib/domain/schemas";
import { VERIFY_METHODS } from "@/lib/domain/types";
import { newId } from "@/lib/ids";
import { allow, TOO_MANY } from "@/lib/security/rate-limit";
import { requireUser } from "./session";

export type SellerFormState = { error: string } | null | undefined;

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
const num = (v: string) => (v === "" ? null : Number(v.replaceAll(",", "")));
const optional = (v: string) => (v === "" ? null : v);
const httpsOrNull = (v: string) => (v === "" ? null : /^https:\/\/[^\s"'<>]+$/.test(v) ? v : undefined);

/** 로그인한 회원과 연결된 작가. 없으면 판매 화면으로 */
async function requireArtist() {
  const me = await requireUser("/account/sell");
  const db = await store.read();
  const artist = db.artists.find((a) => a.userId === me.id);
  if (!artist) redirect("/account/sell");
  return { me, artist };
}

/**
 * 작가가 자기 작품을 올리거나 고친다.
 * - 새 작품은 비공개 + 검수 대기로 들어가고, 관리자가 승인해야 공개된다
 * - 예약 중이거나 판매된 작품은 고칠 수 없다 (구매자가 본 정보가 바뀌지 않도록)
 * - 사진은 회원 업로드(/api/media)로 올린 것만, 영상과 3D는 운영자에게 요청
 */
export async function saveMyWork(workId: string | null, _prev: SellerFormState, form: FormData): Promise<SellerFormState> {
  const { artist } = await requireArtist();
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  if (!(await allow("my-work", 30, 10 * 60_000))) return { error: TOO_MANY };
  const parsed = ArtistWorkInput.safeParse({
    title: s(form, "title"),
    medium: s(form, "medium"),
    kind: s(form, "kind"),
    materials: s(form, "materials"),
    widthCm: Number(s(form, "widthCm")),
    heightCm: Number(s(form, "heightCm")),
    depthCm: num(s(form, "depthCm")),
    weightKg: num(s(form, "weightKg")),
    year: Number(s(form, "year")),
    edition: optional(s(form, "edition")),
    price: Number(s(form, "price").replaceAll(",", "")),
    description: s(form, "description"),
    allowsPickup: form.get("allowsPickup") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const media = parseJson(MediaList, s(form, "media"));
  if (!media) return { error: "사진 목록이 올바르지 않아요" };
  if (!media.some((m) => m.kind === "image")) return { error: "대표 사진을 한 장 이상 올려 주세요" };
  if (media.some((m) => m.kind !== "image")) return { error: "영상과 3D는 문의하기로 보내 주시면 운영자가 붙여 드려요" };
  const story = parseJson(StoryList, s(form, "story"));
  if (!story) return { error: "작품 이야기 형식이 올바르지 않아요" };

  const now = new Date().toISOString();
  const result = await store.update((db) => {
    if (!db.categories.some((c) => c.id === parsed.data.medium)) return "분류를 다시 골라 주세요";
    if (workId) {
      const work = db.works.find((w) => w.id === workId && w.artistId === artist.id);
      if (!work) return "작품을 찾을 수 없어요";
      if (work.status === "reserved" || work.status === "sold") return "예약 중이거나 판매된 작품은 고칠 수 없어요. 문의하기로 알려 주세요";
      Object.assign(work, parsed.data, { media, story, updatedAt: now });
      return work.id;
    }
    const id = newId("w");
    db.works.push({
      id,
      artistId: artist.id,
      exhibitionId: null,
      ...parsed.data,
      status: "hidden",
      pendingReview: true,
      media,
      story,
      operatorOwned: false,
      consignor: null,
      provenance: null,
      appraisal: null,
      featured: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });
  if (!result.startsWith("w-")) return { error: result };
  updateTag(TAG.catalog);
  redirect(`/account/sell/works?saved=${result}`);
}

/** 작가 프로필 (작가 페이지에 보이는 것): 사진, 소개, 링크, 작업실, 주문제작 */
export async function updateMyArtistProfile(_prev: SellerFormState, form: FormData): Promise<SellerFormState> {
  const { artist } = await requireArtist();
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  const avatarRaw = s(form, "avatar");
  const avatar = avatarRaw ? MediaSrc.safeParse(avatarRaw) : null;
  if (avatar && !avatar.success) return { error: "프로필 사진 주소가 올바르지 않아요" };
  const portfolioUrl = httpsOrNull(s(form, "portfolioUrl"));
  if (portfolioUrl === undefined) return { error: "포트폴리오 링크는 https:// 로 시작해야 해요" };
  const bio = s(form, "bio");
  if (bio.length > 1000) return { error: "소개는 1,000자까지예요" };
  const studio = parseJson(StoryList, s(form, "studio"));
  if (!studio) return { error: "작업실 소개 형식이 올바르지 않아요" };
  const instagram = s(form, "instagram").replace(/^@/, "");
  if (instagram && !/^[\w.]{1,30}$/.test(instagram)) return { error: "인스타그램 계정 이름을 확인해 주세요" };
  await store.update((db) => {
    const a = db.artists.find((x) => x.id === artist.id);
    if (!a) return;
    Object.assign(a, {
      avatar: avatar?.data ?? null,
      bio,
      instagram: instagram || null,
      portfolioUrl,
      studio,
      acceptsCommission: a.deathYear == null && form.get("acceptsCommission") === "on",
    });
  });
  updateTag(TAG.catalog);
  refresh();
  return null;
}

/** 마이페이지 프로필 (배경, 사진, 한 줄 소개, 이름, 연락처) */
export async function updateMyProfile(_prev: SellerFormState, form: FormData): Promise<SellerFormState> {
  const me = await requireUser("/account/settings");
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  const read = (k: string) => {
    const v = s(form, k);
    if (!v) return { ok: true as const, value: null };
    const r = MediaSrc.safeParse(v);
    return r.success ? { ok: true as const, value: r.data } : { ok: false as const };
  };
  const avatar = read("avatar");
  const cover = read("cover");
  if (!avatar.ok || !cover.ok) return { error: "사진 주소가 올바르지 않아요" };
  const name = s(form, "name");
  if (!name || name.length > 40) return { error: "이름을 확인해 주세요" };
  const phone = s(form, "phone");
  if (phone.length > 20 || !/^[0-9+\-\s()]*$/.test(phone)) return { error: "연락처는 숫자와 +, - 만 써 주세요" };
  const bio = s(form, "bio");
  if (bio.length > 160) return { error: "한 줄 소개는 160자까지예요" };
  await store.update((db) => {
    const u = db.users.find((x) => x.id === me.id);
    if (u) Object.assign(u, { name, phone: phone || null, bio: bio || null, avatar: avatar.value, cover: cover.value });
  });
  refresh();
  return null;
}

const VerificationInput = z.object({
  schoolName: z.string().trim().min(2, "학교 이름을 입력해 주세요").max(60),
  department: z.string().trim().min(1, "학과를 입력해 주세요").max(60),
  status: z.enum(["student", "graduate"]),
  method: z.enum(VERIFY_METHODS),
});

/**
 * 학교 인증 신청. 방법마다 필요한 것만 받는다:
 * 학교 이메일(ac.kr, edu 주소), 학생증이나 증명서 사진(비공개 저장, 결정 즉시 삭제), 졸업전시 명단(전시 이름)
 */
export async function requestVerification(_prev: SellerFormState, form: FormData): Promise<SellerFormState> {
  const me = await requireUser("/account/verify");
  if (STORE_READONLY) return { error: READONLY_MESSAGE };
  if (!(await allow("verification", 5, 60 * 60_000))) return { error: TOO_MANY };
  const parsed = VerificationInput.safeParse({ schoolName: s(form, "schoolName"), department: s(form, "department"), status: s(form, "status"), method: s(form, "method") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (form.get("agree") !== "on") return { error: "확인용 개인정보 처리에 동의해 주세요" };

  let schoolEmail: string | null = null;
  let document: string | null = null;
  let rosterNote: string | null = null;
  if (v.method === "school_email") {
    schoolEmail = s(form, "schoolEmail").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.(ac\.kr|edu)$/.test(schoolEmail)) return { error: "학교 이메일(ac.kr 또는 edu로 끝나는 주소)을 입력해 주세요" };
  } else if (v.method === "student_id") {
    const file = form.get("document");
    if (!(file instanceof File) || file.size === 0) return { error: "학생증이나 재학, 졸업 증명서 사진을 올려 주세요" };
    try {
      document = await savePrivateImage(file);
    } catch (e) {
      if (e instanceof UploadError) return { error: e.message };
      throw e;
    }
  } else {
    rosterNote = s(form, "rosterNote");
    if (rosterNote.length < 2 || rosterNote.length > 200) return { error: "이름이 실린 졸업전시를 알려 주세요" };
  }

  const ok = await store.update((db) => {
    if (db.verifications.some((x) => x.userId === me.id && x.state === "new")) return false;
    db.verifications.push({
      id: newId("ver"),
      userId: me.id,
      ...v,
      schoolEmail,
      document,
      rosterNote,
      state: "new",
      reason: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    });
    return true;
  });
  if (!ok) {
    await deletePrivate(document); // 올린 서류는 남기지 않는다
    return { error: "이미 확인 중인 신청이 있어요" };
  }
  refresh();
  return null;
}
