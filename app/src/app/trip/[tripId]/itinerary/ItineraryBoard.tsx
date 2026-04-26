"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
  const [openAddDay, setOpenAddDay] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // The sticky chrome lives in the trip layout. Wait for it to mount, then
  // portal our DAY tab bar + active-day label into it so everything sits
  // inside one sticky element with no sub-pixel gaps.
  useEffect(() => {
    setPortalTarget(document.getElementById("trip-extra-sticky"));
  }, []);

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
        { rootMargin: "-220px 0px -60% 0px", threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [days]);

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

    // Option 2: non-admins can reorder within a container but can't move cross-container
    if (!isAdmin) return;

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

    // Option 2: non-admins can reorder within a container but can't move cross-container
    if (!isAdmin && activeContainer !== overContainer) return;

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

    // Persist the new order
    const supabase = createClient();
    const dayDate = overContainer === "kiv" ? null : overContainer;

    let errorMsg: string | null = null;

    if (activeContainer === overContainer) {
      // Same-container reorder — use the RPC so members can trigger the
      // sort_order cascade across siblings they don't own.
      const { error } = await supabase.rpc("reorder_itinerary_items", {
        p_trip_id: tripId,
        p_day_date: dayDate,
        p_item_ids: finalItems.map((i) => i.id),
      });
      if (error) errorMsg = error.message;
    } else {
      // Cross-container move — direct UPDATE. Admin-only; non-admins bail
      // earlier in handleDragOver / handleDragEnd.
      const updates = finalItems.map((item, idx) =>
        supabase
          .from("itinerary_items")
          .update({ day_date: dayDate, sort_order: idx })
          .eq("id", item.id)
          .eq("trip_id", tripId)
      );
      const results = await Promise.all(updates);
      errorMsg = results.find((r) => r.error)?.error?.message ?? null;
    }

    if (errorMsg) {
      setItemsByDay(prevItemsByDay);
      setKivItems(prevKivItems);
      alert(`Failed to reorder: ${errorMsg}`);
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

  // True if the trip already has AI-suggested items — switches the
  // copy in the prompt sheet between "Plan with AI" and "Re-plan with AI".
  const hasAiItems =
    Object.values(itemsByDay).some((items) =>
      items.some((it) => it.source === "ai")
    ) || kivItems.some((it) => it.source === "ai");

  // The DAY tab bar + active-day label live INSIDE the layout's
  // TripStickyChrome via a portal, so the whole sticky region is one
  // contiguous element. Bigger back button, no sub-pixel sticky gaps.
  const dayTabBar = (
    <div
      ref={tabBarRef}
      className="px-4 py-2 bg-white flex gap-2 overflow-x-auto border-t border-gray-100"
    >
      {isAdmin && (
        <button
          onClick={() => setShowAiPrompt(true)}
          aria-label={hasAiItems ? "Re-plan with AI" : "Plan with AI"}
          title={hasAiItems ? "Re-plan with AI" : "Plan with AI"}
          className="shrink-0 w-14 py-1.5 rounded-xl text-center bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:opacity-90 active:opacity-90 text-white transition-opacity"
        >
          <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
            <path d="M5 21v-4" />
            <path d="M19 5v-2" />
          </svg>
          <div className="text-[10px] font-bold leading-tight mt-1 tracking-wider">
            AI
          </div>
        </button>
      )}
      {days.map((day, idx) => {
        const isActive = activeDay === day;
        const dayNumber = String(idx + 1).padStart(2, "0");
        return (
          <button
            key={day}
            data-day={day}
            onClick={() => scrollToSection(`day-${day}`)}
            className={`shrink-0 w-14 py-1.5 rounded-xl text-center transition-colors ${
              isActive
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? "opacity-80" : "opacity-70"}`}>
              Day
            </div>
            <div className="text-base font-bold leading-tight">
              {dayNumber}
            </div>
          </button>
        );
      })}
      {showKiv && (
        <button
          data-day="kiv"
          onClick={() => scrollToSection("kiv-section")}
          className={`shrink-0 w-14 py-1.5 rounded-xl text-center transition-colors ${
            activeDay === "kiv"
              ? "bg-amber-500 text-white"
              : "bg-amber-50 text-amber-600 hover:bg-amber-100"
          }`}
        >
          <div className="text-sm leading-none">📌</div>
          <div className="text-sm font-bold leading-tight mt-1 tracking-wider">
            KIV
          </div>
        </button>
      )}
    </div>
  );

  // Active-day row: the date label for whichever day is currently in view,
  // plus the + button that adds an activity to that day. Replaces the
  // previous per-day sticky headers — they were the source of the
  // sub-pixel sticky-on-sticky shift the user kept noticing.
  let activeDayRow: React.ReactNode = null;
  if (activeDay === "kiv") {
    activeDayRow = (
      <div className="px-4 py-2 bg-white flex items-center gap-2 border-t border-gray-100">
        <span className="text-lg">📌</span>
        <div>
          <p className="font-semibold text-sm text-amber-600">
            KIV ({kivItems.length})
          </p>
          <p className="text-xs text-gray-400">Keep In View</p>
        </div>
      </div>
    );
  } else if (activeDay) {
    const { dayName, dayNum, month } = formatDay(activeDay);
    activeDayRow = (
      <div className="px-4 py-2 bg-white flex items-center justify-between border-t border-gray-100">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-teal-600">{dayNum}</span>
          <div className="text-xs text-gray-400">
            <div className="font-medium text-gray-600">{dayName}</div>
            <div>{month}</div>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            aria-label="Add activity"
            onClick={() =>
              setOpenAddDay((curr) => (curr === activeDay ? null : activeDay))
            }
            className="w-10 h-10 rounded-full bg-teal-50 hover:bg-teal-100 active:bg-teal-100 text-teal-600 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {portalTarget &&
        createPortal(
          <>
            {dayTabBar}
            {activeDayRow}
          </>,
          portalTarget
        )}

      {/* Day sections */}
      <div className="space-y-6">
        {days.map((day) => {
          const dayItems = itemsByDay[day] || [];

          return (
            <DayDropZone key={day} dayDate={day} isAdmin={isAdmin} itemIds={dayItems.map((i) => i.id)}>
              <section
                id={`day-${day}`}
                className="scroll-mt-[var(--trip-chrome-h,220px)]"
              >
                {dayItems.length === 0 ? (
                  <p className="text-xs text-gray-300 italic ml-1">
                    No activities yet
                  </p>
                ) : (
                  <div className="relative pl-8">
                    {/* Timeline vertical line */}
                    <div
                      className="absolute w-0.5 bg-gray-200"
                      style={{ left: 11, top: 16, bottom: 16 }}
                      aria-hidden="true"
                    />
                    <div className="space-y-3">
                      {dayItems.map((item) => (
                        <div key={item.id} className="relative">
                          {/* Timeline dot */}
                          <div
                            className="absolute w-2.5 h-2.5 rounded-full border-2 border-teal-400 bg-white z-10"
                            style={{ left: -25, top: "50%", transform: "translateY(-50%)" }}
                            aria-hidden="true"
                          />
                          <ActivityCard
                            item={item}
                            isAdmin={isAdmin}
                            tripId={tripId}
                            userId={userId}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <AddActivityForm
                  tripId={tripId}
                  dayDate={day}
                  isOpen={openAddDay === day}
                  onClose={() => setOpenAddDay(null)}
                />
              </section>
            </DayDropZone>
          );
        })}

        {/* KIV Section — always visible for admin so items can be dropped here */}
        {showKiv && (
          <DayDropZone dayDate={null} isAdmin={isAdmin} itemIds={kivItems.map((i) => i.id)}>
            <section
              id="kiv-section"
              className="scroll-mt-[var(--trip-chrome-h,220px)] pt-4 border-t border-gray-200"
            >
              {kivItems.length === 0 ? (
                <p className="text-xs text-gray-300 italic ml-1">
                  Drag activities here to park them
                </p>
              ) : (
                <div className="space-y-2">
                  {kivItems.map((item) => (
                    <ActivityCard
                      key={item.id}
                      item={item}
                      isAdmin={isAdmin}
                      tripId={tripId}
                      userId={userId}
                    />
                  ))}
                </div>
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

      {/* AI plan / re-plan prompt sheet — opens when the sparkle button
          in the day tab bar is tapped. Confirms intent before sending the
          user to /setup where they review preferences and trigger the
          actual generation. */}
      {showAiPrompt && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setShowAiPrompt(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-[calc(4rem+1.5rem+env(safe-area-inset-bottom))] animate-slideUp shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-3">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                  <path d="M5 21v-4" />
                  <path d="M19 5v-2" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {hasAiItems
                  ? "Need help re-planning your trip?"
                  : "Need help planning your trip?"}
              </h2>
              <p className="text-sm text-gray-500 leading-snug">
                {hasAiItems
                  ? "We'll regenerate the itinerary based on your trip details and preferences. Existing AI-suggested items will be replaced; anything you've added manually stays."
                  : "We'll suggest a day-by-day itinerary based on your destination, dates, and group preferences. You can edit anything afterwards."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAiPrompt(false)}
                className="flex-1 py-3 rounded-full bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Not now
              </button>
              <Link
                href={`/trip/${tripId}/setup`}
                className="flex-1 py-3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium text-center hover:opacity-90 transition-opacity"
              >
                {hasAiItems ? "Re-plan" : "Continue"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
