import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { deleteCategory, moveCategory, updateCategory } from "@/features/admin/actions";
import { CategoryAddForm } from "@/features/admin/category-add-form";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";

export default async function AdminCategories() {
  const db = await adminDb();
  const list = [...db.categories].sort((a, b) => a.order - b.order);
  const used = (id: string) => db.works.filter((w) => w.medium === id).length;
  return (
    <>
      <AdminHeading
        title="매체 분류"
        description="홈 필터 칩과 작품 정보에 쓰는 이름이에요. 순서대로 보이고, 숨긴 분류는 필터에서 빠져요. '전문 운송'을 켜면 크기와 상관없이 미술품 전문 운송으로 안내해요."
      />
      <div className="mb-6"><CategoryAddForm /></div>
      <ul className="flex flex-col gap-2">
        {list.map((c, i) => (
          <li key={c.id} className="glass flex flex-wrap items-center gap-3 rounded-md p-3">
            <div className="flex gap-1">
              <form action={moveCategory.bind(null, c.id, -1)}><Button type="submit" size="sm" variant="ghost" disabled={i === 0} aria-label={`${c.label} 위로`}>↑</Button></form>
              <form action={moveCategory.bind(null, c.id, 1)}><Button type="submit" size="sm" variant="ghost" disabled={i === list.length - 1} aria-label={`${c.label} 아래로`}>↓</Button></form>
            </div>
            <form action={updateCategory.bind(null, c.id)} className="flex flex-1 flex-wrap items-center gap-3">
              <span className="w-24 font-mono text-xs text-ink-soft">{c.id}</span>
              <Input name="label" defaultValue={c.label} aria-label={`${c.id} 이름`} className="w-40" />
              <Checkbox name="visible" defaultChecked={c.visible} label="보이기" />
              <Checkbox name="artShipping" defaultChecked={c.artShipping} label="전문 운송" />
              <span className="text-xs text-ink-soft">작품 {used(c.id)}점</span>
              <Button type="submit" size="sm" variant="secondary">저장</Button>
            </form>
            {used(c.id) === 0 && (
              <form action={deleteCategory.bind(null, c.id)}><Button type="submit" size="sm" variant="danger">삭제</Button></form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
