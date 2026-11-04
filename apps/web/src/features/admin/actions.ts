"use server";

import { buildCertificate } from "@/features/certificates/build";
import { getBusinessInfo } from "@/lib/site";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TAG } from "@/lib/data/catalog";
import { store } from "@/lib/data/store";
import { buildSampleDatabase } from "@/lib/data/sample";
import { ORDER_NEXT, ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import { LOGO_MARKS, MEDIA_KINDS, WORK_KINDS, type Database, type OrderStatus } from "@/lib/domain/types";
import { newCertificateCode, newId } from "@/lib/ids";
import { readPlace } from "@/features/places/parse";
import { requireAdmin } from "./session";
import { deletePrivate } from "@/lib/data/uploads";
import { notifyInquiryAnswered, notifyOrderStatus } from "@/features/mail/notify";

export type FormState = { error: string } | null;

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
const optional = (v: string) => (v === "" ? null : v);
const num = (v: string) => (v === "" ? null : Number(v));
const httpsOrNull = (v: string) => {
  if (v === "") return null;
  if (!/^https:\/\//.test(v)) throw new Error("링크는 https:// 로 시작해야 해요");
  return v;
};

function touchCatalog() {
  updateTag(TAG.catalog);
}

/* ───────────────────────── 주문 ───────────────────────── */

export async function changeOrderStatus(orderId: string, next: OrderStatus, form: FormData) {
  await requireAdmin();
  const note = s(form, "note");
  await store.update((db) => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order || !ORDER_NEXT[order.status].includes(next)) return;
    const now = new Date().toISOString();
    for (const item of order.items) {
      const work = db.works.find((w) => w.id === item.workId);
      if (!work) continue;
      // 입금 확인 → 판매 완료. 취소 → 이 주문이 잡고 있던 예약만 푼다(이미 판매된 건 그대로).
      if (next === "paid") work.status = "sold";
      if (next === "cancelled" && work.status === "reserved") work.status = "available";
      if (next === "cancelled" && order.status !== "pending_payment" && work.status === "sold") work.status = "available";
      work.updatedAt = now;
    }
    if (next === "paid") order.paidAt = now;
    order.status = next;
    order.history.push({ at: now, status: next, note: note || ORDER_STATUS_LABEL[next] });
  });
  notifyOrderStatus(orderId, next, note);
  touchCatalog();
  refresh();
}

export async function updateOrderDetails(orderId: string, form: FormData) {
  await requireAdmin();
  const quote = s(form, "shippingQuote");
  await store.update((db) => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.shippingQuote = quote === "" ? null : Math.max(0, Math.round(Number(quote)));
    order.adminMemo = s(form, "adminMemo");
  });
  refresh();
}

/* ───────────────────────── 작품 ───────────────────────── */

/** 우리 저장소(/media, 샘플)나 https 주소만, javascript:, data: 같은 스킴은 거절 */
const MediaSrc = z.string().max(500).refine((v) => /^\/(media|samples)\/[\w./-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v), "허용되지 않는 미디어 주소");
const MediaList = z
  .array(z.object({ kind: z.enum(MEDIA_KINDS), src: MediaSrc, poster: MediaSrc.nullish(), alt: z.string().max(200).nullish() }))
  .max(30);

const StoryList = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(3000) }),
      z.object({ kind: z.literal("image"), src: MediaSrc, caption: z.string().trim().max(200).nullable() }),
    ]),
  )
  .max(40);

const WorkInput = z.object({
  title: z.string().min(1, "작품명을 입력해 주세요"),
  artistId: z.string().min(1, "작가를 골라 주세요"),
  exhibitionId: z.string().nullable(),
  medium: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, "분류를 골라 주세요"),
  kind: z.enum(WORK_KINDS),
  materials: z.string().min(1, "재료를 입력해 주세요"),
  widthCm: z.number().positive("가로 크기를 입력해 주세요"),
  heightCm: z.number().positive("세로 크기를 입력해 주세요"),
  depthCm: z.number().positive().nullable(),
  weightKg: z.number().positive().nullable(),
  year: z.number().int().min(1900).max(2100),
  edition: z.string().nullable(),
  price: z.number().int().min(0, "가격을 입력해 주세요"),
  status: z.enum(["available", "reserved", "sold", "hidden"]),
  description: z.string(),
  allowsPickup: z.boolean(),
  operatorOwned: z.boolean(),
  consignor: z.string().max(60, "판매자 표시는 60자까지예요").nullable(),
  provenance: z.string().max(500, "소장 이력은 500자까지예요").nullable(),
  appraisal: z.string().max(200, "감정 정보는 200자까지예요").nullable(),
  featured: z.boolean(),
});

export async function saveWork(workId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = WorkInput.safeParse({
    title: s(form, "title"),
    artistId: s(form, "artistId"),
    exhibitionId: optional(s(form, "exhibitionId")),
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
    status: s(form, "status"),
    description: s(form, "description"),
    allowsPickup: form.get("allowsPickup") === "on",
    operatorOwned: form.get("operatorOwned") === "on",
    consignor: optional(s(form, "consignor")),
    provenance: optional(s(form, "provenance")),
    appraisal: optional(s(form, "appraisal")),
    featured: form.get("featured") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 미디어 목록은 업로드 API(/api/admin/media)로 먼저 올린 뒤 순서대로 JSON으로 넘어온다
  let media: z.infer<typeof MediaList>;
  try {
    const parsedMedia = MediaList.safeParse(JSON.parse(s(form, "media") || "[]"));
    if (!parsedMedia.success) return { error: "미디어 목록이 올바르지 않아요" };
    media = parsedMedia.data;
  } catch {
    return { error: "미디어 목록이 올바르지 않아요" };
  }
  if (!media.some((m) => m.kind === "image")) return { error: "대표 사진을 한 장 이상 올려 주세요" };

  let story: z.infer<typeof StoryList>;
  try {
    const parsedStory = StoryList.safeParse(JSON.parse(s(form, "story") || "[]"));
    if (!parsedStory.success) return { error: "작품 이야기는 글 3,000자, 사진 설명 200자, 40칸까지 넣을 수 있어요" };
    story = parsedStory.data;
  } catch {
    return { error: "작품 이야기 형식이 올바르지 않아요" };
  }

  const now = new Date().toISOString();
  const id = await store.update((db) => {
    if (workId) {
      const work = db.works.find((w) => w.id === workId);
      if (!work) return null;
      Object.assign(work, parsed.data, { media, story, updatedAt: now });
      return work.id;
    }
    const created = { id: newId("w"), ...parsed.data, media, story, createdAt: now, updatedAt: now };
    db.works.push(created);
    return created.id;
  });
  if (!id) return { error: "작품을 찾을 수 없어요" };
  touchCatalog();
  redirect(`/admin/works/${id}?saved=1`);
}

/* ───────────────────────── 작가, 전시, 학교 ───────────────────────── */

export async function saveArtist(artistId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = s(form, "name");
  if (!name) return { error: "작가명을 입력해 주세요" };
  let portfolioUrl: string | null;
  try {
    portfolioUrl = httpsOrNull(s(form, "portfolioUrl"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const birthYear = num(s(form, "birthYear"));
  const deathYear = num(s(form, "deathYear"));
  const thisYear = new Date().getFullYear();
  for (const y of [birthYear, deathYear]) {
    if (y != null && (!Number.isInteger(y) || y < 1800 || y > thisYear)) return { error: "연도는 1800년부터 올해까지 네 자리로 입력해 주세요" };
  }
  if (birthYear != null && deathYear != null && deathYear < birthYear) return { error: "작고 연도가 출생 연도보다 빨라요" };
  let studio: z.infer<typeof StoryList>;
  try {
    const parsedStudio = StoryList.safeParse(JSON.parse(s(form, "studio") || "[]"));
    if (!parsedStudio.success) return { error: "작업실 소개는 글 3,000자, 사진 설명 200자, 40칸까지 넣을 수 있어요" };
    studio = parsedStudio.data;
  } catch {
    return { error: "작업실 소개 형식이 올바르지 않아요" };
  }
  const avatarRaw = s(form, "avatar");
  const avatar = avatarRaw ? MediaSrc.safeParse(avatarRaw) : null;
  if (avatar && !avatar.success) return { error: "프로필 사진 주소가 올바르지 않아요" };
  const memberEmail = s(form, "memberEmail").toLowerCase();
  const fields = {
    name,
    realName: optional(s(form, "realName")),
    avatar: avatar?.data ?? null,
    studio,
    schoolId: optional(s(form, "schoolId")),
    department: optional(s(form, "department")),
    gradYear: num(s(form, "gradYear")),
    status: s(form, "status"),
    verifiedBy: optional(s(form, "verifiedBy")) as "school_email" | "student_id" | "roster" | null,
    verifiedAt: null as string | null,
    bio: s(form, "bio"),
    instagram: optional(s(form, "instagram").replace(/^@/, "")),
    portfolioUrl,
    // 작고 작가는 주문제작을 받을 수 없다
    acceptsCommission: deathYear == null && form.get("acceptsCommission") === "on",
    birthYear,
    deathYear,
    estate: deathYear == null ? null : optional(s(form, "estate")),
  };
  const id = await store.update((db) => {
    if (!db.artistGroups.some((g) => g.id === fields.status)) return "bad-group" as const;
    // 회원 연결: 이메일로 찾는다. 다른 작가에 이미 연결된 회원은 안 된다.
    let userId: string | null = null;
    if (memberEmail) {
      const user = db.users.find((u) => u.email === memberEmail);
      if (!user) return "no-member" as const;
      if (db.artists.some((a) => a.userId === user.id && a.id !== artistId)) return "taken" as const;
      userId = user.id;
    }
    Object.assign(fields, { userId });
    const prev = artistId ? db.artists.find((x) => x.id === artistId) : undefined;
    // 인증 방법이 새로 붙거나 바뀔 때만 확인 시각을 갱신한다.
    fields.verifiedAt = !fields.verifiedBy ? null : prev?.verifiedBy === fields.verifiedBy ? prev.verifiedAt : new Date().toISOString();
    if (artistId) {
      const a = prev;
      if (!a) return null;
      Object.assign(a, fields);
      return a.id;
    }
    const created = { id: newId("art"), ...fields, createdAt: new Date().toISOString() };
    db.artists.push(created);
    return created.id;
  });
  if (id === "bad-group") return { error: "작가 구분을 다시 골라 주세요" };
  if (id === "no-member") return { error: "그 이메일로 가입한 회원이 없어요" };
  if (id === "taken") return { error: "그 회원은 이미 다른 작가 페이지와 연결돼 있어요" };
  if (!id) return { error: "작가를 찾을 수 없어요" };
  touchCatalog();
  redirect(`/admin/artists/${id}?saved=1`);
}

export async function saveExhibition(exhibitionId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const title = s(form, "title");
  const startDate = s(form, "startDate");
  const endDate = s(form, "endDate");
  if (!title || !startDate || !endDate) return { error: "전시명과 기간을 입력해 주세요" };
  if (endDate < startDate) return { error: "종료일이 시작일보다 빨라요" };
  const { place, venue } = readPlace(form, "venue");
  const posterRaw = s(form, "poster");
  const poster = posterRaw ? MediaSrc.safeParse(posterRaw) : null;
  if (poster && !poster.success) return { error: "포스터 이미지 주소가 올바르지 않아요" };
  const participantCount = num(s(form, "participantCount"));
  if (participantCount != null && (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > 2000)) return { error: "참여 인원은 숫자로 입력해 주세요" };
  if (s(form, "instagram") && !/^@?[\w.]{1,30}$|^https?:\/\/(www\.)?instagram\.com\/[\w.]{1,30}\/?$/.test(s(form, "instagram"))) return { error: "인스타그램은 계정 이름이나 주소로 입력해 주세요" };
  let link: string | null;
  try {
    link = httpsOrNull(s(form, "link"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const fields = {
    title,
    schoolId: optional(s(form, "schoolId")),
    department: optional(s(form, "department")),
    venue,
    place,
    startDate,
    endDate,
    description: s(form, "description"),
    link,
    hours: optional(s(form, "hours")),
    opening: optional(s(form, "opening")),
    instagram: optional(s(form, "instagram").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "")),
    poster: poster?.data ?? null,
    participantCount: participantCount,
  };
  await store.update((db) => {
    if (exhibitionId) {
      const e = db.exhibitions.find((x) => x.id === exhibitionId);
      if (e) Object.assign(e, fields);
      return;
    }
    db.exhibitions.push({ id: newId("exh"), ...fields, createdAt: new Date().toISOString() });
  });
  touchCatalog();
  redirect("/admin/exhibitions");
}

export async function addSchool(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = s(form, "name");
  const shortName = s(form, "shortName") || name.replace(/(학교|대학교)$/, "대");
  if (!name) return { error: "학교 이름을 입력해 주세요" };
  const dup = await store.update((db) => {
    if (db.schools.some((x) => x.name === name)) return true;
    db.schools.push({ id: newId("sch"), name, shortName });
    return false;
  });
  if (dup) return { error: "이미 등록된 학교예요" };
  touchCatalog();
  refresh();
  return null;
}

/* ───────────────────────── 입점 신청 ───────────────────────── */

function findOrCreateSchool(db: Database, name: string) {
  if (!name) return null;
  const found = db.schools.find((x) => x.name === name || x.shortName === name);
  if (found) return found.id;
  const created = { id: newId("sch"), name, shortName: name.replace(/(대학교|학교)$/, "대") };
  db.schools.push(created);
  return created.id;
}

export async function reviewApplication(applicationId: string, decision: "approved" | "rejected") {
  await requireAdmin();
  const artistId = await store.update((db) => {
    const app = db.applications.find((a) => a.id === applicationId);
    if (!app || app.state !== "new") return null;
    app.state = decision;
    if (decision === "rejected") return null;
    // 승인 = 작가 프로필 생성. 학교 인증은 서류 확인 후 작가 화면에서 따로 표시한다.
    const artist = {
      id: newId("art"),
      name: app.artistName || app.name,
      realName: app.name,
      userId: app.userId ?? null,
      schoolId: findOrCreateSchool(db, app.schoolName),
      department: app.department || null,
      gradYear: app.gradYear,
      status: app.status,
      verifiedBy: null,
      verifiedAt: null,
      bio: app.message,
      instagram: app.instagram,
      portfolioUrl: app.portfolioUrl,
      acceptsCommission: false,
      avatar: null,
      studio: [],
      birthYear: app.birthYear,
      deathYear: null,
      estate: null,
      createdAt: new Date().toISOString(),
    };
    db.artists.push(artist);
    app.artistId = artist.id;
    return artist.id;
  });
  touchCatalog();
  if (artistId) redirect(`/admin/artists/${artistId}`);
  refresh();
}

/* ───────────────────────── 전시 등록 신청 ───────────────────────── */

export async function reviewExhibitionRequest(requestId: string, decision: "approved" | "rejected") {
  await requireAdmin();
  const exhibitionId = await store.update((db) => {
    const req = db.exhibitionRequests.find((r) => r.id === requestId);
    if (!req || req.state !== "new") return null;
    req.state = decision;
    if (decision === "rejected") return null;
    const exhibition = {
      id: newId("exh"),
      title: req.title,
      schoolId: findOrCreateSchool(db, req.schoolName),
      department: req.department || null,
      venue: req.venue,
      place: req.place,
      startDate: req.startDate,
      endDate: req.endDate,
      description: req.description ?? "",
      link: null,
      instagram: req.instagram ?? null,
      poster: req.poster ?? null,
      participantCount: req.artistCount,
      createdAt: new Date().toISOString(),
    };
    db.exhibitions.push(exhibition);
    req.exhibitionId = exhibition.id;
    return exhibition.id;
  });
  touchCatalog();
  if (exhibitionId) redirect(`/admin/exhibitions/${exhibitionId}`);
  refresh();
}

/* ───────────────────────── 문의 ───────────────────────── */

export async function answerInquiry(inquiryId: string, form: FormData) {
  await requireAdmin();
  const answer = s(form, "answer");
  const close = form.get("close") === "on";
  await store.update((db) => {
    const q = db.inquiries.find((x) => x.id === inquiryId);
    if (!q) return;
    if (answer) {
      q.answer = answer;
      q.answeredAt = new Date().toISOString();
      q.state = "answered";
    }
    if (close) q.state = "closed";
  });
  if (answer) notifyInquiryAnswered(inquiryId);
  refresh();
}

/* ───────────────────────── 매체 분류 ───────────────────────── */

const CategoryCode = z.string().trim().regex(/^[a-z][a-z0-9-]{1,30}$/, "코드는 영문 소문자로 시작하고 소문자·숫자·-만 써 주세요");
const CategoryLabel = z.string().trim().min(1, "이름을 입력해 주세요").max(20, "이름은 20자까지예요");

export async function updateCategory(id: string, form: FormData) {
  await requireAdmin();
  const label = CategoryLabel.safeParse(s(form, "label"));
  if (!label.success) return;
  await store.update((db) => {
    const c = db.categories.find((x) => x.id === id);
    if (!c) return;
    c.label = label.data;
    c.visible = form.get("visible") === "on";
    c.artShipping = form.get("artShipping") === "on";
  });
  touchCatalog();
  refresh();
}

/** 한 칸 위/아래로 옮기고 순서를 1..n으로 다시 매긴다. */
function reorder(rows: { id: string; order: number }[], id: string, delta: -1 | 1) {
  const list = [...rows].sort((a, b) => a.order - b.order);
  const i = list.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((c, k) => (c.order = k + 1));
}

export async function moveCategory(id: string, delta: -1 | 1) {
  await requireAdmin();
  await store.update((db) => reorder(db.categories, id, delta));
  touchCatalog();
  refresh();
}

export async function addCategory(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const code = CategoryCode.safeParse(s(form, "id"));
  if (!code.success) return { error: code.error.issues[0].message };
  const label = CategoryLabel.safeParse(s(form, "label"));
  if (!label.success) return { error: label.error.issues[0].message };
  const dup = await store.update((db) => {
    if (db.categories.some((c) => c.id === code.data)) return true;
    const order = Math.max(0, ...db.categories.map((c) => c.order)) + 1;
    db.categories.push({ id: code.data, label: label.data, order, visible: true, artShipping: form.get("artShipping") === "on" });
    return false;
  });
  if (dup) return { error: "이미 있는 코드예요" };
  touchCatalog();
  refresh();
  return null;
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  await store.update((db) => {
    // 작품이 쓰고 있는 분류는 지우지 않는다(숨기기를 쓰도록)
    if (db.works.some((w) => w.medium === id)) return;
    db.categories = db.categories.filter((c) => c.id !== id);
  });
  touchCatalog();
  refresh();
}

/* ───────────────────────── 작가 구분 ───────────────────────── */

export async function updateArtistGroup(id: string, form: FormData) {
  await requireAdmin();
  const label = CategoryLabel.safeParse(s(form, "label"));
  if (!label.success) return;
  await store.update((db) => {
    const g = db.artistGroups.find((x) => x.id === id);
    if (!g) return;
    g.label = label.data;
    g.visible = form.get("visible") === "on";
  });
  touchCatalog();
  refresh();
}

export async function moveArtistGroup(id: string, delta: -1 | 1) {
  await requireAdmin();
  await store.update((db) => reorder(db.artistGroups, id, delta));
  touchCatalog();
  refresh();
}

export async function addArtistGroup(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const code = CategoryCode.safeParse(s(form, "id"));
  if (!code.success) return { error: code.error.issues[0].message };
  const label = CategoryLabel.safeParse(s(form, "label"));
  if (!label.success) return { error: label.error.issues[0].message };
  const dup = await store.update((db) => {
    if (db.artistGroups.some((g) => g.id === code.data)) return true;
    const order = Math.max(0, ...db.artistGroups.map((g) => g.order)) + 1;
    db.artistGroups.push({ id: code.data, label: label.data, order, visible: true });
    return false;
  });
  if (dup) return { error: "이미 있는 코드예요" };
  touchCatalog();
  refresh();
  return null;
}

export async function deleteArtistGroup(id: string) {
  await requireAdmin();
  await store.update((db) => {
    // 작가가 쓰고 있는 구분은 지우지 않는다(숨기기를 쓰도록)
    if (db.artists.some((a) => a.status === id)) return;
    db.artistGroups = db.artistGroups.filter((g) => g.id !== id);
  });
  touchCatalog();
  refresh();
}

/* ───────────────────────── 작품 보증서 ───────────────────────── */

export async function issueCertificate(orderId: string, workId: string) {
  await requireAdmin();
  const biz = getBusinessInfo();
  const result = await store.update((db) => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return { error: "주문을 찾을 수 없어요" };
    const cert = buildCertificate(db, order, workId, {
      id: newId("cert"),
      code: newCertificateCode(),
      now: new Date().toISOString(),
      issuer: { companyName: biz.companyName, registrationNumber: biz.registrationNumber, artServiceNumber: biz.artServiceNumber },
    });
    if ("error" in cert) return cert;
    db.certificates.push(cert);
    order.history.push({ at: cert.issuedAt, status: order.status, note: `작품 보증서 발급 ${cert.code}「${cert.work.title}」` });
    return cert;
  });
  // 버튼은 발급 가능한 줄에만 보이니, 여기서 막히는 건 동시에 두 번 누른 경우뿐이다
  if ("error" in result) return;
  refresh();
}

export async function revokeCertificate(certificateId: string, form: FormData) {
  await requireAdmin();
  const reason = s(form, "reason").slice(0, 200) || "사유 미기재";
  await store.update((db) => {
    const cert = db.certificates.find((c) => c.id === certificateId);
    if (!cert || cert.revokedAt) return;
    cert.revokedAt = new Date().toISOString();
    cert.revokeReason = reason;
    const order = db.orders.find((o) => o.id === cert.orderId);
    order?.history.push({ at: cert.revokedAt, status: order.status, note: `작품 보증서 취소 ${cert.code}, ${reason}` });
  });
  refresh();
}

/* ───────────────────────── 사이트 설정 ───────────────────────── */

export async function setLogoMark(mark: string) {
  await requireAdmin();
  if (!(LOGO_MARKS as readonly string[]).includes(mark)) return;
  await store.update((db) => {
    db.settings.logoMark = mark as (typeof LOGO_MARKS)[number];
  });
  touchCatalog(); // 헤더, 아이콘, 매니페스트가 같은 캐시 태그를 쓴다
  refresh();
}

/* ───────────────────────── 작가가 올린 작품 검수 ───────────────────────── */

export async function approveWork(workId: string) {
  await requireAdmin();
  await store.update((db) => {
    const w = db.works.find((x) => x.id === workId);
    if (!w || !w.pendingReview) return;
    w.pendingReview = false;
    w.status = "available";
    w.updatedAt = new Date().toISOString();
  });
  touchCatalog();
  refresh();
}

/* ───────────────────────── 정산 ───────────────────────── */

export async function settleItem(orderId: string, workId: string) {
  await requireAdmin();
  await store.update((db) => {
    const o = db.orders.find((x) => x.id === orderId);
    const i = o?.items.find((x) => x.workId === workId);
    if (!o || !i || !o.paidAt || o.status === "cancelled" || i.settledAt) return;
    i.settledAt = new Date().toISOString();
    o.history.push({ at: i.settledAt, status: o.status, note: `작가 정산 완료「${i.title}」` });
  });
  refresh();
}

/* ───────────────────────── 학교 인증 심사 ───────────────────────── */

export async function decideVerification(verificationId: string, decision: "approved" | "rejected", form: FormData) {
  await requireAdmin();
  const reason = s(form, "reason").slice(0, 200) || null;
  const doc = await store.update((db) => {
    const v = db.verifications.find((x) => x.id === verificationId);
    if (!v || v.state !== "new") return null;
    const now = new Date().toISOString();
    v.state = decision;
    v.decidedAt = now;
    v.reason = decision === "rejected" ? reason : null;
    const document = v.document;
    v.document = null; // 서류는 결정과 함께 지운다
    if (decision === "approved") {
      const schoolId = findOrCreateSchool(db, v.schoolName);
      const user = db.users.find((u) => u.id === v.userId);
      if (user && schoolId) user.verification = { schoolId, department: v.department, status: v.status, method: v.method, verifiedAt: now };
      // 이 회원과 연결된 작가 페이지에도 같은 인증을 붙인다
      const artist = db.artists.find((a) => a.userId === v.userId);
      if (artist && schoolId) Object.assign(artist, { schoolId, department: v.department, verifiedBy: v.method, verifiedAt: now });
    }
    return document;
  });
  await deletePrivate(doc ?? null);
  touchCatalog();
  refresh();
}

/* ───────────────────────── 예시 데이터 ───────────────────────── */

/** 오픈 전 화면을 채우는 예시 작가, 작품을 넣는다 (이미 있으면 건너뜀). 모두 "예시" 딱지, 주문 불가 */
export async function addSamples() {
  await requireAdmin();
  const sample = buildSampleDatabase();
  await store.update((db) => {
    const haveArtists = new Set(db.artists.map((a) => a.id));
    const haveWorks = new Set(db.works.map((w) => w.id));
    db.artists.push(...sample.artists.filter((a) => !haveArtists.has(a.id)).map((a) => ({ ...a, sample: true })));
    db.works.push(...sample.works.filter((w) => !haveWorks.has(w.id)).map((w) => ({ ...w, sample: true })));
  });
  touchCatalog();
  refresh();
}

/** 예시 작가, 작품을 모두 뺀다 (회원과 연결된 작가는 남긴다) */
export async function removeSamples() {
  await requireAdmin();
  await store.update((db) => {
    db.works = db.works.filter((w) => !w.sample);
    db.artists = db.artists.filter((a) => !a.sample || a.userId || db.works.some((w) => w.artistId === a.id));
  });
  touchCatalog();
  refresh();
}
