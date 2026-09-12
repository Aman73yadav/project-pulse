CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments visible with task" ON public.task_comments FOR SELECT TO authenticated USING (public.can_view_task(task_id));
CREATE POLICY "insert own comment" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.can_view_task(task_id));
CREATE POLICY "delete own comment or project owner" ON public.task_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.can_manage_project(project_id));
CREATE INDEX idx_task_comments_task ON public.task_comments(task_id, created_at DESC);

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments visible with task" ON public.task_attachments FOR SELECT TO authenticated USING (public.can_view_task(task_id));
CREATE POLICY "insert own attachment" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (uploader_id = auth.uid() AND public.can_view_task(task_id));
CREATE POLICY "delete own attachment or project owner" ON public.task_attachments FOR DELETE TO authenticated USING (uploader_id = auth.uid() OR public.can_manage_project(project_id));
CREATE INDEX idx_task_attachments_task ON public.task_attachments(task_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
  pm uuid;
BEGIN
  SELECT id, task_number, title, assignee_id, project_id INTO t FROM public.tasks WHERE id = NEW.task_id;
  INSERT INTO public.task_activity (task_id, project_id, actor_id, action, detail)
  VALUES (NEW.task_id, NEW.project_id, NEW.author_id, 'commented', t.title);

  IF t.assignee_id IS NOT NULL AND t.assignee_id <> NEW.author_id THEN
    INSERT INTO public.notifications (recipient_id, type, task_id, project_id, message)
    VALUES (t.assignee_id, 'task_comment', NEW.task_id, NEW.project_id,
            'New comment on Task #' || t.task_number || ': ' || t.title);
  END IF;

  SELECT created_by INTO pm FROM public.projects WHERE id = NEW.project_id;
  IF pm IS NOT NULL AND pm <> NEW.author_id AND (t.assignee_id IS NULL OR pm <> t.assignee_id) THEN
    INSERT INTO public.notifications (recipient_id, type, task_id, project_id, message)
    VALUES (pm, 'task_comment', NEW.task_id, NEW.project_id,
            'New comment on Task #' || t.task_number || ': ' || t.title);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_task_comment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_task_comment AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.log_task_comment();

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;

CREATE OR REPLACE FUNCTION public.guard_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_project(NEW.project_id) THEN
    IF NEW.title <> OLD.title
       OR COALESCE(NEW.description,'') <> COALESCE(OLD.description,'')
       OR COALESCE(NEW.assignee_id, '00000000-0000-0000-0000-000000000000') <> COALESCE(OLD.assignee_id, '00000000-0000-0000-0000-000000000000')
       OR NEW.priority <> OLD.priority
       OR COALESCE(NEW.due_date, 'epoch'::timestamptz) <> COALESCE(OLD.due_date, 'epoch'::timestamptz)
       OR NEW.project_id <> OLD.project_id THEN
      RAISE EXCEPTION 'Developers may only change task status';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'done' THEN
        RAISE EXCEPTION 'Only the project manager can mark a task done';
      END IF;
      IF NOT (
        (OLD.status = 'todo' AND NEW.status = 'in_progress')
        OR (OLD.status = 'in_progress' AND NEW.status IN ('todo','in_review'))
        OR (OLD.status = 'in_review' AND NEW.status = 'in_progress')
      ) THEN
        RAISE EXCEPTION 'That status change is not allowed for your role';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_task_update() FROM PUBLIC, anon, authenticated;