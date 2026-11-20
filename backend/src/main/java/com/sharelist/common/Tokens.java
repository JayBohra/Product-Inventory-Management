package com.sharelist.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

/** Generates share codes and secret tokens. */
public final class Tokens {

    /** No look-alike characters (0/O, 1/l/I) so codes are easy to read out loud or type. */
    private static final char[] SLUG_ALPHABET =
            "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    public static final int SLUG_LENGTH = 10;
    private static final Pattern SLUG_PATTERN = Pattern.compile("[A-Za-z0-9]{" + SLUG_LENGTH + "}");

    private static final SecureRandom RANDOM = new SecureRandom();

    private Tokens() {
    }

    /** Public, unguessable code used in share links. */
    public static String newSlug() {
        var slug = new StringBuilder(SLUG_LENGTH);
        for (int i = 0; i < SLUG_LENGTH; i++) {
            slug.append(SLUG_ALPHABET[RANDOM.nextInt(SLUG_ALPHABET.length)]);
        }
        return slug.toString();
    }

    public static boolean looksLikeSlug(String value) {
        return value != null && SLUG_PATTERN.matcher(value).matches();
    }

    /** 256-bit secret that identifies a participant. Only its hash is stored. */
    public static String newSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
