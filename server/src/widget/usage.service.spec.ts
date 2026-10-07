import { Types } from 'mongoose';

import { dayOf, UsageService } from './usage.service.js';

function fakeModel() {
  const docs: { siteId: Types.ObjectId; date: string; messages: number }[] = [];
  return {
    docs,
    updateOne: (
      filter: { siteId: Types.ObjectId; date: string },
      update: { $inc: { messages: number } },
    ) => ({
      exec: async () => {
        let doc = docs.find(
          (d) => d.siteId.equals(filter.siteId) && d.date === filter.date,
        );
        if (!doc)
          docs.push(
            (doc = { siteId: filter.siteId, date: filter.date, messages: 0 }),
          );
        doc.messages += update.$inc.messages;
      },
    }),
    find: (filter: { date: { $gte: string } }) => ({
      lean: () => ({
        exec: async () => docs.filter((d) => d.date >= filter.date.$gte),
      }),
    }),
  };
}

const SITE_A = new Types.ObjectId().toString();
const SITE_B = new Types.ObjectId().toString();

describe('UsageService', () => {
  it('counts messages per site per day', async () => {
    const model = fakeModel();
    const usage = new UsageService(model as never);
    const day = new Date('2026-10-07T10:00:00Z');

    await usage.recordMessage(SITE_A, day);
    await usage.recordMessage(SITE_A, day);
    await usage.recordMessage(SITE_B, day);

    expect(model.docs).toHaveLength(2);
    expect(model.docs.find((d) => String(d.siteId) === SITE_A)?.messages).toBe(
      2,
    );
  });

  it('adds up only this month, across the tenant', async () => {
    const model = fakeModel();
    const usage = new UsageService(model as never);
    await usage.recordMessage(SITE_A, new Date('2026-09-30T23:00:00Z'));
    await usage.recordMessage(SITE_A, new Date('2026-10-02T10:00:00Z'));
    await usage.recordMessage(SITE_B, new Date('2026-10-05T10:00:00Z'));

    const status = await usage.monthlyStatus(
      't1',
      100,
      new Date('2026-10-07T00:00:00Z'),
    );

    expect(status).toEqual({ allowed: true, used: 2, limit: 100 });
  });

  it('stops at the monthly allowance', async () => {
    const model = fakeModel();
    const usage = new UsageService(model as never);
    const now = new Date('2026-10-07T00:00:00Z');
    await usage.recordMessage(SITE_A, now);
    await usage.recordMessage(SITE_A, now);

    expect((await usage.monthlyStatus('t1', 3, now)).allowed).toBe(true);
    expect((await usage.monthlyStatus('t1', 2, now)).allowed).toBe(false);
  });

  it('warns once at 80%, not on every message', async () => {
    const model = fakeModel();
    const usage = new UsageService(model as never);
    const warn = vi
      .spyOn(
        (usage as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    const now = new Date('2026-10-07T00:00:00Z');
    for (let i = 0; i < 8; i++) await usage.recordMessage(SITE_A, now);

    await usage.monthlyStatus('t1', 10, now);
    await usage.monthlyStatus('t1', 10, now);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('uses UTC calendar days', () => {
    expect(dayOf(new Date('2026-10-07T23:59:59Z'))).toBe('2026-10-07');
  });
});
