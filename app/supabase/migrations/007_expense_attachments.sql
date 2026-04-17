-- Support multiple attachments per expense
alter table public.expenses
  add column attachments jsonb not null default '[]';

-- Migrate existing receipt_url into attachments array
update public.expenses
set attachments = jsonb_build_array(jsonb_build_object('url', receipt_url, 'name', 'receipt'))
where receipt_url is not null;
