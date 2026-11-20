package com.sharelist.list;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Someone who opened the share link and joined with a display name. The host is a participant too. */
@Entity
@Table(name = "participant")
public class Participant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "list_id", nullable = false, updatable = false)
    private Long listId;

    @Column(name = "display_name", nullable = false, length = 40)
    private String displayName;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false, length = 64)
    private String tokenHash;

    @Column(name = "is_host", nullable = false, updatable = false)
    private boolean host;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;

    protected Participant() {
    }

    private Participant(Long listId, String displayName, String tokenHash, boolean host, Instant joinedAt) {
        this.listId = listId;
        this.displayName = displayName;
        this.tokenHash = tokenHash;
        this.host = host;
        this.joinedAt = joinedAt;
    }

    public static Participant host(Long listId, String displayName, String tokenHash, Instant now) {
        return new Participant(listId, displayName, tokenHash, true, now);
    }

    public static Participant guest(Long listId, String displayName, String tokenHash, Instant now) {
        return new Participant(listId, displayName, tokenHash, false, now);
    }

    public void rename(String displayName) {
        this.displayName = displayName;
    }

    public Long getId() {
        return id;
    }

    public Long getListId() {
        return listId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public boolean isHost() {
        return host;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
