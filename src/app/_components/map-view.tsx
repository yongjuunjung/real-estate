"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ApartmentExpiryRow } from "@/lib/queries/expiring-leases";

declare global {
  interface Window {
    kakao: typeof kakao;
  }
}

interface Props {
  appKey: string | undefined;
  rows: ApartmentExpiryRow[];
  selectedAptId?: number;
}

type KakaoMap = kakao.maps.Map;

export function MapView({ appKey, rows, selectedAptId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlayBag = useRef<Array<{ destroy: () => void }>>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const openDetail = (aptId: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("apt", String(aptId));
    startTransition(() => router.push(`/?${sp.toString()}`));
  };

  const rowsKey = rows.map((r) => r.apartmentId).join(",");
  const prevRowsKey = useRef("");

  // SDK 로딩 + 지도 초기화
  useEffect(() => {
    if (!appKey || mapRef.current) return;

    setStatus("loading");

    const initMap = () => {
      if (!containerRef.current || mapRef.current) return;
      window.kakao.maps.load(() => {
        if (!containerRef.current) return;
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(37.55, 127.05),
          level: 6,
        });
        mapRef.current = map;
        setStatus("ready");
        drawMarkers(map, true);
        prevRowsKey.current = rowsKey;
      });
    };

    // 1. 이미 로드돼 있으면 바로 init (SPA 네비게이션 케이스)
    if (typeof window !== "undefined" && window.kakao?.maps) {
      initMap();
      return;
    }

    // 2. <script> 직접 주입 (next/script onReady가 외부 SDK에 신뢰 안 가서)
    const scriptId = "kakao-maps-sdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
      script.onerror = () => setStatus("error");
      document.head.appendChild(script);
    }
    script.addEventListener("load", initMap);
    return () => {
      script?.removeEventListener("load", initMap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  // rows / selectedAptId 변경 시 마커 재그리기
  useEffect(() => {
    if (!mapRef.current) return;
    const fit = prevRowsKey.current !== rowsKey;
    drawMarkers(mapRef.current, fit);
    prevRowsKey.current = rowsKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, selectedAptId]);

  function drawMarkers(map: KakaoMap, fitBounds: boolean) {
    for (const o of overlayBag.current) o.destroy();
    overlayBag.current = [];

    const placed = rows.filter((r) => r.lat && r.lon);
    if (placed.length === 0) return;

    const bounds = new window.kakao.maps.LatLngBounds();

    for (const r of placed) {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      const pos = new window.kakao.maps.LatLng(lat, lon);
      bounds.extend(pos);

      const isSelected = selectedAptId === r.apartmentId;
      const tier = r.expiringCount >= 30 ? "hot" : r.expiringCount >= 10 ? "mid" : "low";
      const el = document.createElement("button");
      el.type = "button";
      el.className = `kakao-pin kakao-pin--${tier} ${isSelected ? "kakao-pin--selected" : ""}`;
      el.innerHTML = `
        <div class="kakao-pin__bubble">
          <span class="kakao-pin__count">${r.expiringCount}</span>
          <span class="kakao-pin__name">${escapeHtml(r.apartmentName)}</span>
        </div>
        <div class="kakao-pin__tail"></div>
      `;
      el.onclick = (ev) => {
        ev.stopPropagation();
        openDetail(r.apartmentId);
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        map,
        position: pos,
        content: el,
        yAnchor: 1,
        clickable: true,
      });
      overlayBag.current.push({ destroy: () => overlay.setMap(null) });
    }

    if (fitBounds && !bounds.isEmpty()) {
      map.setBounds(bounds, 24, 24, 24, 24);
      const lvl = map.getLevel();
      // 너무 멀리 줌아웃되면 가독성 떨어지므로 6으로 캡
      if (lvl > 6) map.setLevel(6);
      // 단일 단지면 동네 수준까지 확대
      if (placed.length === 1) map.setLevel(3);
    }
  }

  if (!appKey) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted text-muted-foreground">
        <p className="p-6 text-center text-sm">
          <code>.env.local</code>의 <code>NEXT_PUBLIC_KAKAO_MAP_KEY</code>를 채워.
        </p>
      </div>
    );
  }

  const placedCount = rows.filter((r) => r.lat && r.lon).length;
  const missingCount = rows.length - placedCount;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={containerRef} className="h-full w-full flex-1 bg-muted" />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          지도 SDK 로딩 중…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6 text-center text-sm text-red-600">
          카카오맵 SDK 로딩 실패. 카카오 개발자 콘솔에서 <code>http://localhost:3000</code> 플랫폼이 등록돼 있는지,
          <br />JavaScript 키가 맞는지 확인해.
        </div>
      )}
      {status === "ready" && missingCount > 0 && (
        <div className="absolute left-3 top-3 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow">
          좌표 없는 단지 {missingCount}개는 미표시
        </div>
      )}
      {status === "ready" && placedCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          조건에 맞는 단지가 없어.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
