package com.sharelist.list;

import java.util.Map;

import com.sharelist.common.ApiException;
import com.sharelist.common.ErrorCode;

/**
 * Decides whether a participant may change how many units of an item they hold. Giving units
 * back is always allowed (unless the list is closed); taking more must respect the item's stock,
 * the per-person limit and the one-per-item setting.
 */
final class ClaimRules {

    private ClaimRules() {
    }

    /**
     * @param current          units the participant holds now
     * @param requested        units the participant wants to hold
     * @param claimedOfItem    units of this item held by everyone, including this participant
     * @param participantTotal units this participant holds across the whole list
     */
    static void checkChange(SharedList list, ListItem item, int current, int requested,
            int claimedOfItem, int participantTotal) {
        if (requested < 0) {
            throw new IllegalArgumentException("requested must not be negative");
        }
        if (list.isClosed()) {
            throw new ApiException(ErrorCode.LIST_CLOSED,
                    "This list is closed, so picks can't be changed right now.");
        }
        int extra = requested - current;
        if (extra <= 0) {
            return;
        }
        if (!list.isAllowMultiplePerItem() && requested > 1) {
            throw new ApiException(ErrorCode.ONE_PER_ITEM,
                    "You can take only one of each item in this list.");
        }
        Integer stock = item.getQuantityLimit();
        if (stock != null) {
            int available = Math.max(0, stock - claimedOfItem);
            if (extra > available) {
                String message = available == 0
                        ? "Sorry, \"%s\" is all taken.".formatted(item.getName())
                        : "Only %d of \"%s\" left.".formatted(available, item.getName());
                throw new ApiException(ErrorCode.NOT_ENOUGH_LEFT, message, Map.of("available", available));
            }
        }
        Integer perPerson = list.getMaxPerParticipant();
        if (perPerson != null) {
            int remaining = Math.max(0, perPerson - participantTotal);
            if (extra > remaining) {
                String message = remaining == 0
                        ? "You've reached the limit of %s per person.".formatted(units(perPerson))
                        : "You can take only %d more %s (limit is %d per person)."
                                .formatted(remaining, remaining == 1 ? "item" : "items", perPerson);
                throw new ApiException(ErrorCode.PERSON_LIMIT_REACHED, message,
                        Map.of("remaining", remaining, "limit", perPerson));
            }
        }
    }

    private static String units(int count) {
        return count == 1 ? "1 item" : count + " items";
    }
}
