import type { DetailedHTMLProps, HTMLAttributes } from "react";

// <model-viewer> 웹 컴포넌트(@google/model-viewer)를 JSX에서 쓰기 위한 최소 선언
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        poster?: string;
        alt?: string;
        ar?: boolean;
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        "touch-action"?: string;
        "shadow-intensity"?: string;
        exposure?: string;
        loading?: "auto" | "lazy" | "eager";
      };
    }
  }
}
