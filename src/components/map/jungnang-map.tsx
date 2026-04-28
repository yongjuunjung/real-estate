"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { JUNGNANG_CENTER } from "@/lib/constants";

declare global {
  interface Window {
    kakao: typeof kakao;
  }
}

interface Props {
  appKey: string | undefined;
}

export function JungnangMap({ appKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const init = () => {
    if (initialised.current) return;
    if (typeof window === "undefined") return;
    if (!window.kakao?.maps) return;
    if (!containerRef.current) return;

    window.kakao.maps.load(() => {
      const map = new window.kakao.maps.Map(containerRef.current!, {
        center: new window.kakao.maps.LatLng(JUNGNANG_CENTER.lat, JUNGNANG_CENTER.lng),
        level: 5,
      });
      void map;
      initialised.current = true;
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.kakao?.maps) init();
  }, []);

  if (!appKey) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <div className="max-w-md p-6 text-center text-sm">
          <p className="font-medium">카카오맵 API 키가 설정되지 않았습니다.</p>
          <p className="mt-2 text-xs">
            <code>.env.local</code>에 <code>NEXT_PUBLIC_KAKAO_MAP_KEY</code>를 추가한 뒤 dev 서버를
            재시작하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`}
        strategy="afterInteractive"
        onLoad={init}
        onError={() => setError("카카오맵 SDK 로드 실패")}
      />
      <div ref={containerRef} className="h-full w-full" />
      {error ? (
        <div className="absolute right-3 top-3 rounded-md bg-destructive px-3 py-1 text-xs text-destructive-foreground">
          {error}
        </div>
      ) : null}
    </>
  );
}
