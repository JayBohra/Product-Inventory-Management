package com.sharelist.list;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies accepted by the list API. */
public final class ListRequests {

    private ListRequests() {
    }

    public record CreateList(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 1000) String description,
            @NotBlank @Size(max = 40) String hostName,
            @NotNull @Valid ListSettings settings,
            @NotNull @Size(max = 1000) List<@NotNull @Valid ItemInput> items) {
    }

    public record UpdateList(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 1000) String description,
            @NotNull @Valid ListSettings settings,
            boolean closed) {
    }

    /** @param quantityLimit total units available, or {@code null} for unlimited */
    public record ItemInput(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 300) String note,
            @Min(0) @Max(100_000) Integer quantityLimit) {
    }

    public record Name(@NotBlank @Size(max = 40) String displayName) {
    }

    /** @param quantity how many units the participant wants in total; 0 removes the pick */
    public record SetClaim(@NotNull @Min(0) @Max(1000) Integer quantity) {
    }

    public record ReorderItems(@NotNull @Size(max = 1000) List<@NotNull Long> itemIds) {
    }
}
