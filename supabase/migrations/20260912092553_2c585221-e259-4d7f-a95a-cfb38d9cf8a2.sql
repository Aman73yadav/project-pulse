-- internal-only routines: not callable from the API at all
REVOKE ALL ON FUNCTION public.guard_task_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_task_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_task_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flag_overdue_tasks() FROM PUBLIC, anon, authenticated;

-- role/visibility helpers: needed by RLS policy evaluation for signed-in users only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_manager() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_task(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_task(uuid) TO authenticated;