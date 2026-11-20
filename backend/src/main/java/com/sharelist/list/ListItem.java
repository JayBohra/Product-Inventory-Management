package com.sharelist.list;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "list_item")
public class ListItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "list_id", nullable = false, updatable = false)
    private Long listId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 300)
    private String note;

    /** Total units available to everyone, or {@code null} for unlimited. */
    @Column(name = "quantity_limit")
    private Integer quantityLimit;

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ListItem() {
    }

    public ListItem(Long listId, String name, String note, Integer quantityLimit, int position, Instant now) {
        this.listId = listId;
        this.name = name;
        this.note = note;
        this.quantityLimit = quantityLimit;
        this.position = position;
        this.createdAt = now;
    }

    public void update(String name, String note, Integer quantityLimit) {
        this.name = name;
        this.note = note;
        this.quantityLimit = quantityLimit;
    }

    public void moveTo(int position) {
        this.position = position;
    }

    public Long getId() {
        return id;
    }

    public Long getListId() {
        return listId;
    }

    public String getName() {
        return name;
    }

    public String getNote() {
        return note;
    }

    public Integer getQuantityLimit() {
        return quantityLimit;
    }

    public int getPosition() {
        return position;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
