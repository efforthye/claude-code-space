import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { deleteArtistGroup, moveArtistGroup, updateArtistGroup } from "@/features/admin/actions";
import { ArtistGroupAddForm } from "@/features/admin/artist-group-add-form";
import { adminDb } from "@/features/admin/session";
import { AdminHeading } from "@/features/admin/ui";

export default async function AdminArtistGroups() {
  const db = await adminDb();
  const list = [...db.artistGroups].sort((a, b) => a.order - b.order);
  const used = (id: string) => db.artists.filter((a) => a.status === id).length;
  return (
    <>
      <AdminHeading
        title="작가 구분"
        description="작가 목록의 필터 칩과 작가 정보에 쓰는 이름이에요. 순서대로 보이고, 숨긴 구분은 필터에서 빠져요. 작고 작가는 작가 화면에서 작고 연도를 넣으면 따로 표시돼요."
      />
      <div className="mb-6"><ArtistGroupAddForm /></div>
      <ul className="flex flex-col gap-2">
        {list.map((g, i) => (
          <li key={g.id} className="glass flex flex-wrap items-center gap-3 rounded-md p-3">
            <div className="flex gap-1">
              <form action={moveArtistGroup.bind(null, g.id, -1)}><Button type="submit" size="sm" variant="ghost" disabled={i === 0} aria-label={`${g.label} 위로`}>↑</Button></form>
              <form action={moveArtistGroup.bind(null, g.id, 1)}><Button type="submit" size="sm" variant="ghost" disabled={i === list.length - 1} aria-label={`${g.label} 아래로`}>↓</Button></form>
            </div>
            <form action={updateArtistGroup.bind(null, g.id)} className="flex flex-1 flex-wrap items-center gap-3">
              <span className="w-24 font-mono text-xs text-ink-soft">{g.id}</span>
              <Input name="label" defaultValue={g.label} aria-label={`${g.id} 이름`} className="w-40" />
              <Checkbox name="visible" defaultChecked={g.visible} label="필터에 보이기" />
              <span className="text-xs text-ink-soft">작가 {used(g.id)}명</span>
              <Button type="submit" size="sm" variant="secondary">저장</Button>
            </form>
            {used(g.id) === 0 && (
              <form action={deleteArtistGroup.bind(null, g.id)}><Button type="submit" size="sm" variant="danger">삭제</Button></form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
