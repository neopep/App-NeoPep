export function origins(): string[] {
  const backend = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  if (backend === 'https://qnuluspqfazdppciermw.supabase.co') {
    return ['https://teste.app.neopep.com.br'];
  }
  return (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',').map(value => value.trim()).filter(Boolean);
}
