-- 0002_push_tokens.sql — Expo push-token registry (Phase 11.1, DEC-050/052).
-- The bushel-mobile app registers its Expo push token here so bushel can fan
-- order-arrival notifications out to Annabel's device (bushel-mobile Phase 1).
-- First migration after the 0001 consolidation: prod is live (Phase 10.7), so
-- this can't fold back into the baseline — a fresh DB now replays 0001 then 0002.
-- No FK on admin_id per DEC-048 (the service layer is the access boundary); the
-- token itself is unique, so a device re-registering upserts in place and
-- re-points to whichever admin is signed in on it.

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,                    -- admins.id (bare uuid, no FK — DEC-048)
    expo_push_token text NOT NULL,             -- ExponentPushToken[...] from expo-notifications
    platform text NOT NULL,                    -- 'android' | 'ios' (app-enforced, like orders.status)
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT push_tokens_expo_push_token_key UNIQUE (expo_push_token)
);

COMMENT ON TABLE public.push_tokens IS
  'Expo push tokens for the bushel-mobile app (Phase 11). One row per device; expo_push_token is unique so re-registration upserts. admin_id is admins.id, no FK (DEC-048).';
