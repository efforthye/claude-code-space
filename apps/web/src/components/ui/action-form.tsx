"use client";

import { startTransition, type ComponentProps } from "react";

/**
 * React 19는 `<form action={fn}>` 제출 뒤 입력값을 모두 비운다. 검증 오류가 나면
 * 사용자가 쓴 내용이 사라지므로, 제출을 직접 가로채 useActionState의 dispatch를 부른다.
 */
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (data: FormData) => void }) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(data));
      }}
    />
  );
}
