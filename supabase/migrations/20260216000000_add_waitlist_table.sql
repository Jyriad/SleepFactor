-- Waitlist table for marketing website sign-ups.
-- Anonymous users can INSERT; only authenticated/service can SELECT.

CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT waitlist_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);

-- Prevent duplicate emails (one sign-up per address)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_key ON public.waitlist (lower(email));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to insert a row
CREATE POLICY "Anyone can join waitlist"
    ON public.waitlist FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Only authenticated users can read (e.g. you when logged into app/dashboard)
CREATE POLICY "Authenticated users can view waitlist"
    ON public.waitlist FOR SELECT
    TO authenticated
    USING (true);

-- No public UPDATE or DELETE
COMMENT ON TABLE public.waitlist IS 'Marketing site waitlist sign-ups. Insert allowed anonymously; select requires auth.';
