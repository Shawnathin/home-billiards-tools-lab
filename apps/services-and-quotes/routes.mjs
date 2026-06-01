import express from 'express';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUOTE_LINES = 50;
const MAX_QUANTITY = 99;

export const servicesAndQuotesApiRouter = express.Router();

servicesAndQuotesApiRouter.get('/categories', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        c.id,
        c.name,
        c.description,
        c.sort_order as "sortOrder",
        c.is_active as "isActive",
        count(s.id)::integer as "activeServiceCount"
      from service_categories c
      left join services s
        on s.category_id = c.id
        and s.is_active = true
      where c.is_active = true
      group by c.id
      order by c.sort_order asc, lower(c.name) asc
    `);

    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
});

servicesAndQuotesApiRouter.get('/services', async (req, res, next) => {
  try {
    const result = await pool.query(`
      select
        s.id,
        s.category_id as "categoryId",
        c.name as "categoryName",
        s.name,
        s.description,
        s.base_price_cents as "basePriceCents",
        s.unit_label as "unitLabel",
        s.sort_order as "sortOrder"
      from services s
      left join service_categories c on c.id = s.category_id
      where s.is_active = true
        and (c.id is null or c.is_active = true)
      order by
        coalesce(c.sort_order, 9999) asc,
        lower(coalesce(c.name, 'Uncategorized')) asc,
        s.sort_order asc,
        lower(s.name) asc
    `);

    res.json({ services: result.rows });
  } catch (error) {
    next(error);
  }
});

servicesAndQuotesApiRouter.post('/quote-preview', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body?.lineItems)
        ? req.body.lineItems
        : null;

    const normalized = normalizeQuoteItems(items);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    if (normalized.items.length === 0) {
      return res.json({
        subtotalCents: 0,
        formattedSubtotal: formatCents(0),
        lineItems: []
      });
    }

    const serviceIds = normalized.items.map((item) => item.serviceId);
    const result = await pool.query(
      `
        select
          s.id,
          s.name,
          s.description,
          s.base_price_cents as "basePriceCents",
          s.unit_label as "unitLabel",
          s.category_id as "categoryId",
          c.name as "categoryName"
        from services s
        left join service_categories c on c.id = s.category_id
        where s.id = any($1::uuid[])
          and s.is_active = true
          and (c.id is null or c.is_active = true)
      `,
      [serviceIds]
    );

    const servicesById = new Map(result.rows.map((service) => [service.id, service]));
    const missingService = serviceIds.find((serviceId) => !servicesById.has(serviceId));

    if (missingService) {
      return res.status(400).json({ error: 'One or more selected services are unavailable.' });
    }

    let subtotalCents = 0;
    const lineItems = normalized.items.map((item) => {
      const service = servicesById.get(item.serviceId);
      const unitPriceCents = Number(service.basePriceCents);
      const lineSubtotalCents = unitPriceCents * item.quantity;
      subtotalCents += lineSubtotalCents;

      return {
        serviceId: service.id,
        name: service.name,
        description: service.description,
        categoryId: service.categoryId,
        categoryName: service.categoryName,
        quantity: item.quantity,
        unitLabel: service.unitLabel,
        unitPriceCents,
        lineSubtotalCents,
        formattedUnitPrice: formatCents(unitPriceCents),
        formattedLineSubtotal: formatCents(lineSubtotalCents)
      };
    });

    return res.json({
      subtotalCents,
      formattedSubtotal: formatCents(subtotalCents),
      lineItems
    });
  } catch (error) {
    return next(error);
  }
});

function normalizeQuoteItems(items) {
  if (!Array.isArray(items)) {
    return { error: 'Quote preview requires an items array.' };
  }

  if (items.length > MAX_QUOTE_LINES) {
    return { error: `Quote preview is limited to ${MAX_QUOTE_LINES} line items.` };
  }

  const mergedItems = new Map();

  for (const item of items) {
    const serviceId = String(item?.serviceId || item?.id || '').trim();
    const quantity = Number(item?.quantity);

    if (!UUID_PATTERN.test(serviceId)) {
      return { error: 'Each line item needs a valid service id.' };
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { error: `Quantities must be whole numbers from 1 to ${MAX_QUANTITY}.` };
    }

    const existingItem = mergedItems.get(serviceId);
    const nextQuantity = (existingItem?.quantity || 0) + quantity;

    if (nextQuantity > MAX_QUANTITY) {
      return { error: `Each service quantity is limited to ${MAX_QUANTITY}.` };
    }

    mergedItems.set(serviceId, { serviceId, quantity: nextQuantity });
  }

  return { items: [...mergedItems.values()] };
}

function formatCents(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}
