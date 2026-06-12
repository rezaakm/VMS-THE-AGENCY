create or replace function public.record_vendor_payment(
  p_ap_id uuid,
  p_amount numeric,
  p_date date default current_date,
  p_account_id uuid default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text; v_old_paid numeric; v_original numeric; v_new_paid numeric;
  v_new_balance numeric; v_vendor text; v_acct uuid; v_acct_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  select a.entity, coalesce(a.paid_amount,0), coalesce(a.original_amount, a.balance),
         (select v.name from vendors v where v.id = a.vendor_id)
    into v_entity, v_old_paid, v_original, v_vendor
  from ap_entries a where a.id = p_ap_id;
  if not found then raise exception 'Payable not found'; end if;
  v_new_paid := v_old_paid + p_amount;
  v_new_balance := greatest(v_original - v_new_paid, 0);
  update ap_entries set paid_amount = v_new_paid, balance = v_new_balance, updated_at = now() where id = p_ap_id;
  v_acct := p_account_id;
  if v_acct is null then
    select id into v_acct from bank_accounts where is_active is distinct from false order by current_balance desc nulls last limit 1;
  end if;
  update bank_accounts set current_balance = coalesce(current_balance,0) - p_amount, updated_at = now()
    where id = v_acct returning current_balance into v_acct_balance;
  if not found then raise exception 'Bank account not found'; end if;
  insert into bank_transactions(debit, credit, entity, reference, description, transaction_date, bank_account_id, running_balance, is_reconciled)
  values (p_amount, 0, coalesce(v_entity,'agency'), 'AP:'||p_ap_id::text,
          'Payment'||coalesce(' to '||v_vendor,'')||coalesce(' — '||p_note,''),
          coalesce(p_date, current_date), v_acct, v_acct_balance, false);
  return jsonb_build_object('ap_balance', v_new_balance, 'paid_amount', v_new_paid, 'account_balance', v_acct_balance);
end;
$$;
grant execute on function public.record_vendor_payment(uuid, numeric, date, uuid, text) to authenticated;
