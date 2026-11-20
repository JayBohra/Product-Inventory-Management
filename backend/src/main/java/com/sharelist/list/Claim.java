package com.sharelist.list;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** How many units of one item one participant has taken. Rows with zero quantity are deleted. */
@Entity
@Table(name = "claim")
public class Claim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "list_id", nullable = false, updatable = false)
    private Long listId;

    @Column(name = "item_id", nullable = false, updatable = false)
    private Long itemId;

    @Column(name = "participant_id", nullable = false, updatable = false)
    private Long participantId;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Claim() {
    }

    public Claim(Long listId, Long itemId, Long participantId, int quantity, Instant now) {
        this.listId = listId;
        this.itemId = itemId;
        this.participantId = participantId;
        this.quantity = quantity;
        this.updatedAt = now;
    }

    public void changeQuantity(int quantity, Instant now) {
        this.quantity = quantity;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getListId() {
        return listId;
    }

    public Long getItemId() {
        return itemId;
    }

    public Long getParticipantId() {
        return participantId;
    }

    public int getQuantity() {
        return quantity;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
