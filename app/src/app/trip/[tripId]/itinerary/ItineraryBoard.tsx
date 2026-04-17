"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItineraryItemWithProfile } from "@/lib/types";
import DayDropZone from "./DayDropZone";
import ActivityCard from "./ActivityCard";
import AddActivityForm from "./AddActivityForm";

interface ItineraryBoardProps {
  days: string[];
  initialItemsByDay: Record<string, ItineraryItemWithProfile[]>;
  initialKivItems: ItineraryItemWithProfile[];
  isAdmin: boolean;
  tripId: string;
  userId: string;
}

export default function ItineraryBoard({
  days,
  initialItemsByDay,
  initialKivItems,
  isAdmin,
  tripId,
  userId,
}: ItineraryBoardProps) {
  const router = useRouter();
  const [itemsByDay, setItemsByDay] = useState(initialItemsByDay);
  const [kivItems, setKivItems] = useState(initialKivItems);
  const [activeItem, setActiveItem] = useState<ItineraryItemWithProfile | null>(
    null
  );
  const [activeDay, setActiveDay] = useState(days[0] || "");
  const [showFab, setShowFab] = useState(false);
  const fabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Sync local state when server data changes (e.g. AddActivityForm submit)
  useEffect(() => {
    setItemsByDay(initialItemsByDay);
    setKivItems(initialKivItems);
  }, [initialItemsByDay, initialKivItems]);

  // IntersectionObserver to track which day section is in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const allIds = [...days.map((d) => `day-${d}`), "kiv-section"];

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveDay(id === "kiv-section" ? "kiv" : id.replace("day-", ""));
          }
        },
        { rootMargin: "-140px 0px -60% 0px", threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [days]);

  // Show FAB on scroll, hide after 2s of inactivity
  useEffect(() => {
    const handleScroll = () => {
      setShowFab(true);
      if (fabTimerRef.current) clearTimeout(fabTimerRef.current);
      fabTimerRef.current = setTimeout(() => setShowFab(false), 2000);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (fabTimerRef.current) clearTimeout(fabTimerRef.current);
    };
  }, []);

  // Scroll active tab pill into view within the tab bar
  useEffect(() => {
    const activeTab = tabBarRef.current?.querySelector(
      `[data-day="${activeDay}"]`
    );
    activeTab?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeDay]);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const findItem = useCallback(
    (id: string): ItineraryItemWithProfile | null => {
      for (const dayItems of Object.values(itemsByDay)) {
        const found = dayItems.find((i) => i.id === id);
        if (found) return found;
      }
      return kivItems.find((i) => i.id === id) || null;
    },
    [itemsByDay, kivItems]
  );

  const findContainer = useCallback(
    (itemId: string): string | null => {
      for (const [day, items] of Object.entries(itemsByDay)) {
        if (items.some((i) => i.id === itemId)) return day;
      }
      if (kivItems.some((i) => i.id === itemId)) return "kiv";
      return null;
    },
    [itemsByDay, kivItems]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = findItem(event.active.id as string);
    setActiveItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    let overContainer: string | null;

    if (overId.startsWith("day:")) {
      overContainer = overId.replace("day:", "");
    } else if (overId === "kiv") {
      overContainer = "kiv";
    } else {
      overContainer = findContainer(overId);
    }

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    const item = findItem(activeId);
    if (!item) return;

    const newDayDate = overContainer === "kiv" ? null : overContainer;
    const updatedItem = { ...item, day_date: newDayDate };

    if (activeContainer === "kiv") {
      setKivItems((prev) => prev.filter((i) => i.id !== activeId));
    } else {
      setItemsByDay((prev) => ({
        ...prev,
        [activeContainer]: prev[activeContainer].filter((i) => i.id !== activeId),
      }));
    }

    if (overContainer === "kiv") {
      setKivItems((prev) => [...prev, updatedItem]);
    } else {
      setItemsByDay((prev) => {
        const target = prev[overContainer!] || [];
        const overIndex = target.findIndex((i) => i.id === overId);
        const insertAt = overIndex >= 0 ? overIndex : target.length;
        const next = [...target];
        next.splice(insertAt, 0, updatedItem);
        return { ...prev, [overContainer!]: next };
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    if (!activeContainer) return;

    let overContainer: string | null;
    if (overId.startsWith("day:")) {
      overContainer = overId.replace("day:", "");
    } else if (overId === "kiv") {
      overContainer = "kiv";
    } else {
      overContainer = findContainer(overId);
    }

    if (!overContainer) return;

    // Snapshot for rollback
    const prevItemsByDay = Object.fromEntries(
      Object.entries(itemsByDay).map(([k, v]) => [k, [...v]])
    );
    const prevKivItems = [...kivItems];

    // Compute the final ordered list for the target container
    let finalItems: ItineraryItemWithProfile[];

    if (activeContainer === overContainer && activeId !== overId) {
      // Within-container reorder
      const source = overContainer === "kiv" ? [...kivItems] : [...(itemsByDay[overContainer] || [])];
      const oldIdx = source.findIndex((i) => i.id === activeId);
      const newIdx = source.findIndex((i) => i.id === overId);
      if (oldIdx < 0 || newIdx < 0) return;
      finalItems = arrayMove(source, oldIdx, newIdx);

      if (overContainer === "kiv") {
        setKivItems(finalItems);
      } else {
        setItemsByDay((prev) => ({ ...prev, [overContainer!]: finalItems }));
      }
    } else if (activeContainer !== overContainer) {
      // Cross-container move (already handled by handleDragOver — just read current state)
      finalItems = overContainer === "kiv" ? [...kivItems] : [...(itemsByDay[overContainer] || [])];
    } else {
      return;
    }

    // Persist sort_order for all items in the target container
    const supabase = createClient();
    const dayDate = overContainer === "kiv" ? null : overContainer;

    const updates = finalItems.map((item, idx) =>
      supabase
        .from("itinerary_items")
        .update({ day_date: dayDate, sort_order: idx })
        .eq("id", item.id)
        .eq("trip_id", tripId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);

    if (failed?.error) {
      setItemsByDay(prevItemsByDay);
      setKivItems(prevKivItems);
      alert(`Failed to reorder: ${failed.error.message}`);
    } else {
      router.refresh();
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return {
      dayName: d.toLocaleDateString("en-MY", { weekday: "short" }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("en-MY", { month: "short" }),
    };
  };

  const scrollToSection = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showKiv = isAdmin || kivItems.length > 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Re-plan button — admin only */}
      {isAdmin && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => router.push(`/trip/${tripId}/setup`)}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-500 hover:text-purple-700 transition-colors px-3 py-1.5 rounded-full border border-purple-100 hover:border-purple-200 bg-purple-50"
          >
            ✨ Re-plan trip
          </button>
        </div>
      )}

      {/* Sticky day tab bar */}
      <div
        ref={tabBarRef}
        className="sticky top-[5.8rem] z-30 -mx-4 px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex gap-2 overflow-x-auto"
      >
        {days.map((day) => {
          const { dayName, dayNum } = formatDay(day);
          const isActive = activeDay === day;
          return (
            <button
              key={day}
              data-day={day}
              onClick={() => scrollToSection(`day-${day}`)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-teal-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {dayNum} {dayName}
            </button>
          );
        })}
        {showKiv && (
          <button
            data-day="kiv"
            onClick={() => scrollToSection("kiv-section")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeDay === "kiv"
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-600 hover:bg-amber-100"
            }`}
          >
            📌 KIV
          </button>
        )}
      </div>

      {/* Day sections */}
      <div className="space-y-6 mt-4">
        {days.map((day) => {
          const { dayName, dayNum, month } = formatDay(day);
          const dayItems = itemsByDay[day] || [];

          return (
            <DayDropZone key={day} dayDate={day} isAdmin={isAdmin} itemIds={dayItems.map((i) => i.id)}>
              <section id={`day-${day}`} className="scroll-mt-[8.75rem]">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-teal-600">
                    {dayNum}
                  </span>
                  <div className="text-xs text-gray-400">
                    <div className="font-medium text-gray-600">{dayName}</div>
                    <div>{month}</div>
                  </div>
                </div>

                {dayItems.length === 0 ? (
                  <p className="text-xs text-gray-300 italic ml-1">
                    No activities yet
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {dayItems.map((item) => (
                      <ActivityCard
                        key={item.id}
                        item={item}
                        isAdmin={isAdmin}
                        tripId={tripId}
                        userId={userId}
                      />
                    ))}
                  </ul>
                )}

                <AddActivityForm tripId={tripId} dayDate={day} />
              </section>
            </DayDropZone>
          );
        })}

        {/* KIV Section — always visible for admin so items can be dropped here */}
        {showKiv && (
          <DayDropZone dayDate={null} isAdmin={isAdmin} itemIds={kivItems.map((i) => i.id)}>
            <section
              id="kiv-section"
              className="scroll-mt-[8.75rem] pt-4 border-t border-gray-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📌</span>
                <div>
                  <p className="font-semibold text-sm text-amber-600">
                    KIV ({kivItems.length})
                  </p>
                  <p className="text-xs text-gray-400">Keep In View</p>
                </div>
              </div>
              {kivItems.length === 0 ? (
                <p className="text-xs text-gray-300 italic ml-1">
                  Drag activities here to park them
                </p>
              ) : (
                <ul className="space-y-2">
                  {kivItems.map((item) => (
                    <ActivityCard
                      key={item.id}
                      item={item}
                      isAdmin={isAdmin}
                      tripId={tripId}
                      userId={userId}
                    />
                  ))}
                </ul>
              )}
            </section>
          </DayDropZone>
        )}
      </div>

      <DragOverlay>
        {activeItem ? (
          <ActivityCard
            item={activeItem}
            isAdmin={isAdmin}
            tripId={tripId}
            userId={userId}
            isOverlay
          />
        ) : null}
      </DragOverlay>

      {/* Floating back-to-top button — visible only during/after scroll */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-40 w-11 h-11 rounded-full bg-white/70 hover:bg-white backdrop-blur-sm shadow-md border border-gray-100 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${
          showFab ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <svg className="w-5 h-5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </DndContext>
  );
}
