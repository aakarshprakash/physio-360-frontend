import { describe, expect, it } from 'vitest';
import { ApiError, serializeQuery, toApiError } from './client';

describe('api client helpers', () => {
  it('serialises queries the way Laravel expects', () => {
    expect(serializeQuery({ from: '2026-10-12', practitioner_ids: [1, 2], status: '', empty: null, nope: undefined, flag: true })).toBe(
      'from=2026-10-12&practitioner_ids%5B%5D=1&practitioner_ids%5B%5D=2&flag=1',
    );
  });

  it('normalises validation errors', async () => {
    const res = new Response(JSON.stringify({ message: 'Invalid', errors: { phone: ['The phone format is invalid.'] } }), { status: 422 });
    const err = await toApiError(res);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.isValidation).toBe(true);
    expect(err.fieldError('phone')).toBe('The phone format is invalid.');
  });

  it('exposes booking conflicts and domain error codes', async () => {
    const res = new Response(JSON.stringify({ message: 'Busy', code: 'slot_conflict', conflicts: [{ resource: 'room', appointment_id: 9 }] }), { status: 409 });
    const err = await toApiError(res);

    expect(err.code).toBe('slot_conflict');
    expect(err.conflicts[0].resource).toBe('room');
  });

  it('unwrap keeps the server message even after the body was consumed', async () => {
    const { unwrap } = await import('./client');
    const response = new Response(JSON.stringify({ message: 'These details do not match an active patient account.' }), { status: 422 });
    await response.text(); // simulate openapi-fetch having read the body
    const failing = unwrap(Promise.resolve({ error: { message: 'These details do not match an active patient account.', errors: { email: ['Nope'] } }, response }));

    await expect(failing).rejects.toMatchObject({ status: 422, message: 'These details do not match an active patient account.' });
    await failing.catch((e: ApiError) => expect(e.fieldError('email')).toBe('Nope'));
  });

  it('survives non-JSON error pages', async () => {
    const err = await toApiError(new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
    expect(err.status).toBe(502);
    expect(err.message).toBe('Bad Gateway');
  });
});
