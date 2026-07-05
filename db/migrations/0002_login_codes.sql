-- 0002_login_codes — admin sign-in via emailed one-time codes (DEC-047,
-- supersedes DEC-003's Google-OAuth admin login).
--
-- Two tables:
--   admins       — the allowlist. Only these emails can request a code; the row
--                  id is the session subject and the per-user attribution key
--                  (customer_sends.sent_by_user_id, once repointed in 10.4).
--   login_codes  — muster's 0012 ported (a SIBLING to nothing here — bushel has
--                  no magic_tokens). One live code per admin: the (subject_kind,
--                  subject_id) PK; re-request upserts. Only sha256(code) is
--                  stored; security rests on the 5-attempt cap + 10-min TTL, not
--                  the code's entropy. Deviation from muster: timestamptz columns
--                  (not text) to match this baseline — src/lib/db.ts parses
--                  timestamptz → ISO string, so the auth logic sees the same
--                  shape muster's text columns gave it.
--
-- No foreign keys (DEC-048 — the service layer is the access boundary).

CREATE TABLE public.admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admins_pkey PRIMARY KEY (id),
    CONSTRAINT admins_email_key UNIQUE (email)
);

COMMENT ON TABLE public.admins IS 'Admin sign-in allowlist (DEC-047). email is the login identity; only listed rows can request a login code. id is the session subject + per-user attribution key.';

CREATE TABLE public.login_codes (
    subject_kind text NOT NULL,               -- 'admin' (bushel has no other subject)
    subject_id   text NOT NULL,               -- admins.id as text
    code_hash    text NOT NULL,               -- sha256(code) hex; the code is never stored
    created_at   timestamp with time zone DEFAULT now() NOT NULL,
    expires_at   timestamp with time zone NOT NULL,  -- dead past this even if unconsumed
    attempts     integer DEFAULT 0 NOT NULL,  -- failed verifies; the brute-force ceiling
    consumed_at  timestamp with time zone,    -- null until redeemed (single-use CAS)
    CONSTRAINT login_codes_pkey PRIMARY KEY (subject_kind, subject_id)  -- one live code per subject
);

COMMENT ON TABLE public.login_codes IS 'One-time admin sign-in codes (DEC-047, ported from muster 0012). Keyed by subject so attempts can cap brute-force against the short code. Only the hash is stored.';

-- The allowlist. Emails are the gate; anything not here cannot request a code.
-- (The Playwright test admin is upserted by tests/global-setup.ts, not seeded
--  here, so it never reaches prod.)
INSERT INTO public.admins (email, name) VALUES
  ('e.t.urner217@gmail.com', 'Emma Turner'),
  ('eric@stoffer.net',       'Eric'),
  ('annabel@stoffer.net',    'Annabel');
