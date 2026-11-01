"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TAG } from "@/lib/data/catalog";
import { store } from "@/lib/data/store";
import { saveImage } from "@/lib/data/uploads";
import { ORDER_NEXT, ORDER_STATUS_LABEL } from "@/lib/domain/rules";
import { MEDIA, WORK_KINDS, type Database, type OrderStatus } from "@/lib/domain/types";
import { newId } from "@/lib/ids";
import { requireAdmin } from "./session";

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

const WorkInput = z.object({
  title: z.string().min(1, "작품명을 입력해 주세요"),
  artistId: z.string().min(1, "작가를 골라 주세요"),
  exhibitionId: z.string().nullable(),
  medium: z.enum(MEDIA),
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
    featured: form.get("featured") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 기존 이미지(순서 유지, 체크 해제된 것은 제외) + 새로 올린 이미지
  const kept = form.getAll("keepImage").map(String);
  const uploads = form.getAll("newImages").filter((f): f is File => f instanceof File && f.size > 0);
  const urlImage = s(form, "imageUrl");
  let added: string[];
  try {
    added = await Promise.all(uploads.map(saveImage));
    if (urlImage) added.push(httpsOrNull(urlImage)!);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const images = [...kept, ...added];
  if (images.length === 0) return { error: "대표 이미지를 한 장 이상 올려 주세요" };

  const now = new Date().toISOString();
  const id = await store.update((db) => {
    if (workId) {
      const work = db.works.find((w) => w.id === workId);
      if (!work) return null;
      Object.assign(work, parsed.data, { images, updatedAt: now });
      return work.id;
    }
    const created = { id: newId("w"), ...parsed.data, images, createdAt: now, updatedAt: now };
    db.works.push(created);
    return created.id;
  });
  if (!id) return { error: "작품을 찾을 수 없어요" };
  touchCatalog();
  redirect(`/admin/works/${id}?saved=1`);
}

/* ───────────────────────── 작가 · 전시 · 학교 ───────────────────────── */

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
  const fields = {
    name,
    schoolId: optional(s(form, "schoolId")),
    department: optional(s(form, "department")),
    gradYear: num(s(form, "gradYear")),
    status: s(form, "status") as "student" | "graduate" | "aspiring" | "general",
    verifiedBy: optional(s(form, "verifiedBy")) as "school_email" | "student_id" | "roster" | null,
    verifiedAt: null as string | null,
    bio: s(form, "bio"),
    instagram: optional(s(form, "instagram").replace(/^@/, "")),
    portfolioUrl,
    acceptsCommission: form.get("acceptsCommission") === "on",
  };
  const id = await store.update((db) => {
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
    venue: s(form, "venue"),
    startDate,
    endDate,
    description: s(form, "description"),
    link,
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
      name: app.name,
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
      startDate: req.startDate,
      endDate: req.endDate,
      description: "",
      link: null,
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
