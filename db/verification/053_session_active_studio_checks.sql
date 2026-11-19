-- Staging-only checks for migration 053.
-- Verify active_shop_id is present without modifying current sessions.
SELECT column_name,data_type FROM information_schema.columns
 WHERE table_schema='private' AND table_name='sessions'
   AND column_name='active_shop_id';

-- Confirm public helper has no public/anonymous execution grants.
SELECT has_function_privilege('PUBLIC','private.set_session_active_studio(text,uuid,uuid)','EXECUTE') AS public_can_switch,
       has_function_privilege('authenticated','private.set_session_active_studio(text,uuid,uuid)','EXECUTE') AS authenticated_can_switch;

-- Expected: both values false. The live session still derives the studio
-- from profiles until all RLS and application role checks are migrated.
