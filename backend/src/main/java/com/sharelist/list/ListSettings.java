package com.sharelist.list;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Rules the host chooses for a list.
 *
 * @param allowMultiplePerItem whether a participant may take more than one unit of the same item
 * @param maxPerParticipant    maximum total units one participant may take across the list, or
 *                             {@code null} for no limit
 * @param showClaimants        whether participants can see who took what (the host always can)
 */
public record ListSettings(
        boolean allowMultiplePerItem,
        @Min(1) @Max(1000) Integer maxPerParticipant,
        boolean showClaimants) {
}
