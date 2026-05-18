package com.longfeng.calendar.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * P10 spec §5 #1 · GET /api/calendar/events?month=YYYY-MM response shape.
 *
 * <p>Shape per spec §5 行 1 L143: <code>{month, days:[{date, events:[...]}]}</code>.
 *
 * <p>Note: BE only returns dates within the queried month that have ≥1 event.
 * The FE P10 page constructs the 42-cell month grid (incl. prev/next month
 * spillover for the first / last partial weeks) from the calendar layout itself
 * and overlays color dots / event-count bars by matching {@code DayBucket#date}.
 */
public record CalendarMonthResp(
        /** "YYYY-MM" · echoes query param for FE confirmation. */
        String month,
        /** Per-date event buckets · ASC by date · empty when month has 0 events. */
        List<DayBucket> days
) {
    public record DayBucket(
            LocalDate date,
            List<CalendarEventResp> events) {}
}
