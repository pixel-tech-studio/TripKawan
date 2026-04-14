"use client";

import { useDroppable } from "@dnd-kit/core";

interface DayDropZoneProps {
  dayDate: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}

export default function DayDropZone({
  dayDate,
  isAdmin,
  children,
}: DayDropZoneProps) {
  const droppableId = dayDate ? `day:${dayDate}` : "kiv";

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !isAdmin,
  });

  const highlightClass =
    isAdmin && isOver
      ? dayDate
        ? "ring-2 ring-teal-400/50 bg-teal-50/20"
        : "ring-2 ring-amber-400/50 bg-amber-50/30"
      : "";

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl p-1 -m-1 transition-all duration-200 ${highlightClass}`}
    >
      {children}
    </div>
  );
}
