CREATE OR REPLACE FUNCTION public.has_admin_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$ SELECT public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.admin_unlock_sessions WHERE user_id=auth.uid() AND session_id=COALESCE(auth.jwt()->>'session_id',encode(extensions.digest(auth.jwt()::text,'sha256'),'hex')) AND expires_at>now()); $$;
CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE c public.admin_pin_credentials%ROWTYPE; sid text; BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin account required'; END IF;
 sid := COALESCE(auth.jwt()->>'session_id',encode(extensions.digest(auth.jwt()::text,'sha256'),'hex'));
 SELECT * INTO c FROM public.admin_pin_credentials WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Admin entry code is not configured'; END IF;
 IF c.locked_until>now() THEN RAISE EXCEPTION 'Too many attempts. Try again in 15 minutes.'; END IF;
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' OR extensions.crypt(p_pin,c.pin_hash)<>c.pin_hash THEN
 UPDATE public.admin_pin_credentials SET failed_attempts=CASE WHEN locked_until<=now() THEN 1 ELSE failed_attempts+1 END, locked_until=CASE WHEN (CASE WHEN locked_until<=now() THEN 1 ELSE failed_attempts+1 END)>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=auth.uid(); RETURN false; END IF;
 UPDATE public.admin_pin_credentials SET failed_attempts=0,locked_until=NULL WHERE user_id=auth.uid();
 INSERT INTO public.admin_unlock_sessions(user_id,session_id,expires_at) VALUES(auth.uid(),sid,now()+interval '30 minutes') ON CONFLICT(user_id,session_id) DO UPDATE SET expires_at=EXCLUDED.expires_at;
 RETURN true; END; $$;
CREATE OR REPLACE FUNCTION public.lock_admin_access() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$ DELETE FROM public.admin_unlock_sessions WHERE user_id=auth.uid() AND session_id=COALESCE(auth.jwt()->>'session_id',encode(extensions.digest(auth.jwt()::text,'sha256'),'hex')); $$;