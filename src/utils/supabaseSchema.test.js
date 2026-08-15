import fs from 'fs';
import path from 'path';

test('remote draw rate limit is consumed before host readiness checks', () => {
  const schema = fs.readFileSync(path.join(process.cwd(), 'supabase/schema.sql'), 'utf8');
  const functionStart = schema.indexOf('create function public.request_remote_draw');
  const functionEnd = schema.indexOf('create or replace function public.claim_remote_draw_command', functionStart);
  const requestFunction = schema.slice(functionStart, functionEnd);
  const rateGuard = requestFunction.indexOf("previous_request > now() - interval '2 seconds'");
  const rateUpdate = requestFunction.indexOf('set last_remote_request_at = now()');
  const readinessLookup = requestFunction.indexOf('select states.state into public_state');
  const notReadyReturn = requestFunction.indexOf("'accepted', false", readinessLookup);

  expect(functionStart).toBeGreaterThanOrEqual(0);
  expect(rateGuard).toBeGreaterThanOrEqual(0);
  expect(rateUpdate).toBeGreaterThan(rateGuard);
  expect(rateUpdate).toBeLessThan(readinessLookup);
  expect(notReadyReturn).toBeGreaterThan(readinessLookup);
  expect(requestFunction).not.toMatch(/raise exception 'The host is not ready/);
  expect(requestFunction.match(/set last_remote_request_at = now\(\)/g)).toHaveLength(1);
});
