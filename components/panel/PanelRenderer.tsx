'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanelManifest } from '@/types/ublx';
import { GridCanvas24x32, GridItem } from './GridCanvas';
import { ComponentRenderer } from './ComponentRenderer';
import { Plus } from 'lucide-react';
import { useUpdateComponentRect } from '@/lib/api/db-hooks';

interface PanelRendererProps {
  manifest: PanelManifest;
}

type Rect = { x: number; y: number; w: number; h: number };
type DragMode = 'move' | 'resize';
type DragState = {
  instanceId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startRect: Rect;
};

const COLS = 32;
const ROWS = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function PanelRenderer({ manifest }: PanelRendererProps) {
  const updateRect = useUpdateComponentRect();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localRects, setLocalRects] = useState<Record<string, Rect>>({});

  const manifestRectMap = useMemo(
    () =>
      Object.fromEntries(
        manifest.components.map((comp) => [comp.instance_id, { ...comp.rect }])
      ) as Record<string, Rect>,
    [manifest.components]
  );

  useEffect(() => {
    setLocalRects(manifestRectMap);
  }, [manifestRectMap]);

  const startDrag = (instanceId: string, mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    const current = localRects[instanceId] ?? manifestRectMap[instanceId];
    if (!current) return;
    setDragState({
      instanceId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: current,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const cellW = bounds.width / COLS;
      const cellH = bounds.height / ROWS;

      const deltaCols = Math.round((e.clientX - dragState.startClientX) / Math.max(cellW, 1));
      const deltaRows = Math.round((e.clientY - dragState.startClientY) / Math.max(cellH, 1));

      const next = { ...dragState.startRect };
      if (dragState.mode === 'move') {
        next.x = clamp(dragState.startRect.x + deltaCols, 0, COLS - dragState.startRect.w);
        next.y = clamp(dragState.startRect.y + deltaRows, 0, ROWS - dragState.startRect.h);
      } else {
        next.w = clamp(dragState.startRect.w + deltaCols, 1, COLS - dragState.startRect.x);
        next.h = clamp(dragState.startRect.h + deltaRows, 1, ROWS - dragState.startRect.y);
      }

      setLocalRects((prev) => ({ ...prev, [dragState.instanceId]: next }));
    };

    const onUp = () => {
      setLocalRects((prev) => {
        const finalRect = prev[dragState.instanceId];
        const originalRect = manifestRectMap[dragState.instanceId];
        if (
          finalRect &&
          originalRect &&
          (finalRect.x !== originalRect.x ||
            finalRect.y !== originalRect.y ||
            finalRect.w !== originalRect.w ||
            finalRect.h !== originalRect.h)
        ) {
          updateRect.mutate({
            panelId: manifest.panel_id,
            instanceId: dragState.instanceId,
            rect: finalRect,
          });
        }
        return prev;
      });
      setDragState(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, manifest.panel_id, manifestRectMap, updateRect]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-2 flex items-center justify-end">
        <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-medium text-white/30">
          {manifest.name}
        </div>
      </div>
      
      <div className="flex-1 relative">
        {manifest.components.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center border border-white/10 rounded-lg bg-white/[0.02]">
            <div className="w-10 h-10 bg-white/5 rounded flex items-center justify-center mb-3">
              <Plus size={24} className="text-white/20" />
            </div>
            <p className="text-xs font-medium text-white/45">No components yet</p>
            <p className="text-[10px] text-white/25 mt-1">Open Store to add widgets</p>
          </div>
        ) : (
          <div ref={canvasRef} className="w-full h-full">
            <GridCanvas24x32>
            {manifest.components.map((comp) => (
              <GridItem key={comp.instance_id} {...(localRects[comp.instance_id] ?? comp.rect)}>
                <ComponentRenderer
                  instance={comp}
                  panelId={manifest.panel_id}
                  onMoveStart={(instanceId, e) => startDrag(instanceId, 'move', e)}
                  onResizeStart={(instanceId, e) => startDrag(instanceId, 'resize', e)}
                />
              </GridItem>
            ))}
            </GridCanvas24x32>
          </div>
        )}
      </div>
    </div>
  );
}
