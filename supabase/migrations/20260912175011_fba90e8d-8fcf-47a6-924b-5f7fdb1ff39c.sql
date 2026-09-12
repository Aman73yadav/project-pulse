CREATE POLICY "task files readable with task"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-files'
  AND public.can_view_task(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "task files uploadable with task"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-files'
  AND public.can_view_task(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "task files removable by uploader or manager"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-files'
  AND (
    owner = auth.uid()
    OR public.can_manage_project(((storage.foldername(name))[1])::uuid)
  )
);