-- A list that one person (the host) shares with others through a link.
create table shared_list (
    id                      bigint generated always as identity primary key,
    slug                    varchar(16)   not null unique,
    title                   varchar(120)  not null,
    description             varchar(1000),
    allow_multiple_per_item boolean       not null default true,
    max_per_participant     integer       check (max_per_participant > 0),
    show_claimants          boolean       not null default true,
    closed                  boolean       not null default false,
    -- Incremented on every change; clients use it to know when to refresh.
    revision                bigint        not null default 0,
    created_at              timestamptz   not null default now(),
    updated_at              timestamptz   not null default now()
);

create index shared_list_updated_at_idx on shared_list (updated_at);

create table list_item (
    id             bigint generated always as identity primary key,
    list_id        bigint       not null references shared_list (id) on delete cascade,
    name           varchar(120) not null,
    note           varchar(300),
    -- null means unlimited
    quantity_limit integer      check (quantity_limit >= 0),
    position       integer      not null,
    created_at     timestamptz  not null default now(),
    unique (id, list_id)
);

create index list_item_list_idx on list_item (list_id, position);

create table participant (
    id           bigint generated always as identity primary key,
    list_id      bigint      not null references shared_list (id) on delete cascade,
    display_name varchar(40) not null,
    -- SHA-256 of the participant's secret token; the token itself is never stored.
    token_hash   varchar(64) not null unique,
    is_host      boolean     not null default false,
    joined_at    timestamptz not null default now(),
    unique (id, list_id)
);

create unique index participant_name_uq on participant (list_id, lower(display_name));
create unique index participant_one_host_uq on participant (list_id) where is_host;

-- How many units of an item a participant has taken.
create table claim (
    id             bigint generated always as identity primary key,
    list_id        bigint      not null,
    item_id        bigint      not null,
    participant_id bigint      not null,
    quantity       integer     not null check (quantity > 0),
    updated_at     timestamptz not null default now(),
    unique (item_id, participant_id),
    -- Composite keys guarantee the item and the participant belong to the same list.
    foreign key (item_id, list_id) references list_item (id, list_id) on delete cascade,
    foreign key (participant_id, list_id) references participant (id, list_id) on delete cascade
);

create index claim_list_idx on claim (list_id);
create index claim_participant_idx on claim (participant_id);
