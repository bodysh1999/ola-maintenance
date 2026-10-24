-- 25) Payroll: judge absence only up to YESTERDAY (today isn't over yet — a draft run mid-day
--     must not count people who simply haven't checked in yet)
do $$
declare f text; n text;
begin
  f := pg_get_functiondef('public.generate_payroll(text,boolean)'::regprocedure);
  if position('v_today - 1)' in f) = 0 then
    n := replace(f, 'v_until := least(v_end, v_today);', 'v_until := least(v_end, v_today - 1);');
    if n = f then raise exception 'generate_payroll: pattern not found'; end if;
    execute n;
  end if;
end $$;
