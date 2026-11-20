package com.sharelist.list;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "shared_list")
public class SharedList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, updatable = false, length = 16)
    private String slug;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(name = "allow_multiple_per_item", nullable = false)
    private boolean allowMultiplePerItem;

    @Column(name = "max_per_participant")
    private Integer maxPerParticipant;

    @Column(name = "show_claimants", nullable = false)
    private boolean showClaimants;

    @Column(nullable = false)
    private boolean closed;

    @Column(nullable = false)
    private long revision;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SharedList() {
    }

    public SharedList(String slug, String title, String description, ListSettings settings, Instant now) {
        this.slug = slug;
        this.title = title;
        this.description = description;
        applySettings(settings);
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(String title, String description, ListSettings settings, boolean closed) {
        this.title = title;
        this.description = description;
        this.closed = closed;
        applySettings(settings);
    }

    /** Records that something in the list (including its items or claims) changed. */
    public void markChanged(Instant now) {
        this.revision++;
        this.updatedAt = now;
    }

    private void applySettings(ListSettings settings) {
        this.allowMultiplePerItem = settings.allowMultiplePerItem();
        this.maxPerParticipant = settings.maxPerParticipant();
        this.showClaimants = settings.showClaimants();
    }

    public ListSettings settings() {
        return new ListSettings(allowMultiplePerItem, maxPerParticipant, showClaimants);
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public boolean isAllowMultiplePerItem() {
        return allowMultiplePerItem;
    }

    public Integer getMaxPerParticipant() {
        return maxPerParticipant;
    }

    public boolean isShowClaimants() {
        return showClaimants;
    }

    public boolean isClosed() {
        return closed;
    }

    public long getRevision() {
        return revision;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
