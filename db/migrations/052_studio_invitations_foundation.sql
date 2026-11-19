-- Additive invitation records. Acceptance is deliberately not enabled until
-- active-studio RLS and membership activation are deployed and tested.
CREATE TABLE IF NOT EXISTS public.studio_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
 email text NOT NULL,
 role text NOT NULL CHECK(role IN ('madam','staff','freelancer','trainee','trainer')),
 token_hash text NOT NULL UNIQUE,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
 expires_at timestamptz NOT NULL,
 accepted_by uuid REFERENCES auth.users(id),
 accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT invitation_email_normalized CHECK(email=lower(btrim(email)) AND length(email)>3),
 CONSTRAINT invitation_acceptance_consistent CHECK (
   (status='accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
   OR (status<>'accepted' AND accepted_by IS NULL AND accepted_at IS NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS studio_invitations_pending_email_idx
 ON public.studio_invitations(shop_id,email) WHERE status='pending';
CREATE INDEX IF NOT EXISTS studio_invitations_shop_status_idx
 ON public.studio_invitations(shop_id,status);
CREATE INDEX IF NOT EXISTS studio_invitations_expiry_idx
 ON public.studio_invitations(expires_at) WHERE status='pending';
ALTER TABLE public.studio_invitations ENABLE ROW LEVEL SECURITY;
-- No direct user-facing read/write policies. Invitations are accessed
-- through owner-authorized and token-validated server endpoints only.
COMMENT ON TABLE public.studio_invitations IS 'Private hashed-token invitation staging table; activation requires multi-studio isolation rollout.';
