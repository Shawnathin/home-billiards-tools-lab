import express from 'express';
import { pool } from '../../src/db.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 260;
const MAX_MONEY_CENTS = 999999999;
const MAX_QUANTITY = 9999999999.99;

const PRODUCT_STATUS_OPTIONS = [
  ['draft', 'Draft'],
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['special_order', 'Special order'],
  ['discontinued', 'Discontinued'],
  ['archived', 'Archived'],
  ['review_needed', 'Review needed']
];

const PRODUCT_TYPE_OPTIONS = [
  ['physical_product', 'Physical product'],
  ['part', 'Part'],
  ['consumable', 'Consumable'],
  ['accessory', 'Accessory'],
  ['cloth', 'Cloth'],
  ['cue', 'Cue'],
  ['service_related_item', 'Service-related item'],
  ['special_order_item', 'Special-order item'],
  ['other', 'Other']
];

const STOCK_UNIT_OPTIONS = [
  ['each', 'Each'],
  ['set', 'Set'],
  ['pair', 'Pair'],
  ['box', 'Box'],
  ['case', 'Case'],
  ['roll', 'Roll'],
  ['yard', 'Yard'],
  ['linear_yard', 'Linear yard'],
  ['metre', 'Metre'],
  ['bottle', 'Bottle'],
  ['can', 'Can'],
  ['tube', 'Tube'],
  ['pack', 'Pack'],
  ['cube', 'Cube'],
  ['kit', 'Kit'],
  ['hour', 'Hour'],
  ['other', 'Other']
];

const INVENTORY_CONFIDENCE_OPTIONS = [
  ['unverified', 'Unverified'],
  ['estimated', 'Estimated'],
  ['counted', 'Counted'],
  ['review_needed', 'Review needed']
];

const ADJUSTMENT_TYPE_OPTIONS = [
  ['initial_count', 'Initial count'],
  ['manual_increase', 'Manual increase'],
  ['manual_decrease', 'Manual decrease'],
  ['count_correction', 'Count correction'],
  ['stock_received', 'Stock received'],
  ['sale_or_customer_out', 'Sale or customer out'],
  ['service_use', 'Service use'],
  ['damaged_or_scrapped', 'Damaged or scrapped'],
  ['returned_to_stock', 'Returned to stock'],
  ['location_transfer', 'Location transfer'],
  ['lost_or_missing', 'Lost or missing'],
  ['review_adjustment', 'Review adjustment']
];

const PRODUCT_STATUSES = new Set(PRODUCT_STATUS_OPTIONS.map(([value]) => value));
const PRODUCT_TYPES = new Set(PRODUCT_TYPE_OPTIONS.map(([value]) => value));
const STOCK_UNITS = new Set(STOCK_UNIT_OPTIONS.map(([value]) => value));
const INVENTORY_CONFIDENCE_VALUES = new Set(INVENTORY_CONFIDENCE_OPTIONS.map(([value]) => value));
const ADJUSTMENT_TYPES = new Set(ADJUSTMENT_TYPE_OPTIONS.map(([value]) => value));

const productSelectSql = `
  select
    p.id,
    p.category_id as "categoryId",
    c.name as "categoryName",
    c.slug as "categorySlug",
    p.name,
    p.internal_sku as "internalSku",
    p.brand,
    p.manufacturer,
    p.model,
    p.product_type as "productType",
    p.status,
    p.short_description as "shortDescription",
    p.staff_notes as "staffNotes",
    p.stock_unit as "stockUnit",
    p.inventory_tracking_enabled as "inventoryTrackingEnabled",
    p.is_taxable as "isTaxable",
    p.cost_cents as "costCents",
    p.retail_price_cents as "retailPriceCents",
    p.msrp_cents as "msrpCents",
    p.archived_at as "archivedAt",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt",
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'productId', pi.product_id,
          'locationId', pi.location_id,
          'locationName', il.name,
          'locationCode', il.location_code,
          'quantityOnHand', pi.quantity_on_hand,
          'lowStockThreshold', pi.low_stock_threshold,
          'inventoryConfidence', pi.inventory_confidence,
          'lastCountedAt', pi.last_counted_at,
          'notes', pi.notes,
          'updatedAt', pi.updated_at
        )
        order by il.sort_order asc, lower(il.name) asc
      ) filter (where pi.id is not null),
      '[]'::jsonb
    ) as inventory
  from products p
  left join product_categories c on c.id = p.category_id
  left join product_inventory pi on pi.product_id = p.id
  left join inventory_locations il on il.id = pi.location_id
`;

export const productsInventoryApiRouter = express.Router();

productsInventoryApiRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const [categories, locations] = await Promise.all([getCategories(), getLocations()]);

    res.json({
      categories,
      locations,
      productStatuses: toOptionObjects(PRODUCT_STATUS_OPTIONS),
      productTypes: toOptionObjects(PRODUCT_TYPE_OPTIONS),
      stockUnits: toOptionObjects(STOCK_UNIT_OPTIONS),
      inventoryConfidenceValues: toOptionObjects(INVENTORY_CONFIDENCE_OPTIONS),
      adjustmentTypes: toOptionObjects(ADJUSTMENT_TYPE_OPTIONS)
    });
  } catch (error) {
    next(error);
  }
});

productsInventoryApiRouter.get('/categories', async (req, res, next) => {
  try {
    res.json({ categories: await getCategories() });
  } catch (error) {
    next(error);
  }
});

productsInventoryApiRouter.get('/locations', async (req, res, next) => {
  try {
    res.json({ locations: await getLocations() });
  } catch (error) {
    next(error);
  }
});

productsInventoryApiRouter.get('/products', async (req, res, next) => {
  try {
    const { whereSql, values } = buildProductFilters(req.query || {});
    const result = await pool.query(
      `
        ${productSelectSql}
        ${whereSql}
        group by p.id, c.id
        order by
          case when p.status = 'review_needed' then 0 else 1 end,
          p.updated_at desc,
          lower(p.name) asc
        limit 150
      `,
      values
    );
    const products = result.rows.map(formatProduct);

    res.json({
      products,
      summary: summarizeProducts(products)
    });
  } catch (error) {
    next(error);
  }
});

productsInventoryApiRouter.get('/products/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid product id is required.' });
    }

    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const adjustments = await getAdjustments({ productId: id, limit: 50 });

    return res.json({ product, adjustments });
  } catch (error) {
    return next(error);
  }
});

productsInventoryApiRouter.post('/products', async (req, res, next) => {
  try {
    const normalized = await normalizeProductInput(req.body || {}, null);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const product = await insertProduct(normalized.data);
    return res.status(201).json({ product });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Product could not be saved. Check required fields and SKU uniqueness.' });
    }

    return next(error);
  }
});

productsInventoryApiRouter.patch('/products/:id', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid product id is required.' });
    }

    const existing = await getProductById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const normalized = await normalizeProductInput(req.body || {}, existing);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const product = await updateProduct(id, existing, normalized.data);
    return res.json({ product });
  } catch (error) {
    if (isValidationConstraintError(error) || error.code === '23505') {
      return res.status(400).json({ error: 'Product could not be saved. Check required fields and SKU uniqueness.' });
    }

    return next(error);
  }
});

productsInventoryApiRouter.post('/products/:id/archive', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid product id is required.' });
    }

    const product = await archiveProduct(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

productsInventoryApiRouter.post('/products/:id/reactivate', async (req, res, next) => {
  try {
    const id = readUuid(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'A valid product id is required.' });
    }

    const product = await reactivateProduct(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

productsInventoryApiRouter.get('/inventory', async (req, res, next) => {
  try {
    const { whereSql, values } = buildInventoryFilters(req.query || {});
    const result = await pool.query(
      `
        select
          pi.id,
          pi.product_id as "productId",
          p.name as "productName",
          p.internal_sku as "internalSku",
          p.stock_unit as "stockUnit",
          p.inventory_tracking_enabled as "inventoryTrackingEnabled",
          pi.location_id as "locationId",
          il.name as "locationName",
          il.location_code as "locationCode",
          pi.quantity_on_hand as "quantityOnHand",
          pi.low_stock_threshold as "lowStockThreshold",
          pi.inventory_confidence as "inventoryConfidence",
          pi.last_counted_at as "lastCountedAt",
          pi.notes,
          pi.created_at as "createdAt",
          pi.updated_at as "updatedAt"
        from product_inventory pi
        join products p on p.id = pi.product_id
        join inventory_locations il on il.id = pi.location_id
        ${whereSql}
        order by lower(p.name) asc, il.sort_order asc, lower(il.name) asc
        limit 250
      `,
      values
    );

    res.json({ inventory: result.rows.map(formatInventoryRow) });
  } catch (error) {
    next(error);
  }
});

productsInventoryApiRouter.get('/inventory/adjustments', async (req, res, next) => {
  try {
    const productId = readOptionalUuid(req.query.productId || req.query.product_id);
    const locationId = readOptionalUuid(req.query.locationId || req.query.location_id);
    const adjustmentType = cleanText(req.query.adjustmentType || req.query.adjustment_type, { maxLength: 80 });

    if ((req.query.productId || req.query.product_id) && !productId) {
      return res.status(400).json({ error: 'Product filter needs a valid product id.' });
    }

    if ((req.query.locationId || req.query.location_id) && !locationId) {
      return res.status(400).json({ error: 'Location filter needs a valid location id.' });
    }

    if (adjustmentType && !ADJUSTMENT_TYPES.has(adjustmentType)) {
      return res.status(400).json({ error: 'Choose a valid adjustment type.' });
    }

    const limit = parseLimit(req.query.limit, 100);
    const adjustments = await getAdjustments({ productId, locationId, adjustmentType, limit });
    return res.json({ adjustments });
  } catch (error) {
    return next(error);
  }
});

productsInventoryApiRouter.post('/inventory/adjustments', async (req, res, next) => {
  try {
    const normalized = normalizeAdjustmentInput(req.body || {});

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const adjustedBy = req.session?.user?.displayName || req.session?.user?.username || 'Staff';
    const result = await createInventoryAdjustment(normalized.data, adjustedBy);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({
      adjustment: result.adjustment,
      inventory: result.inventory
    });
  } catch (error) {
    if (isValidationConstraintError(error)) {
      return res.status(400).json({ error: 'Inventory adjustment could not be saved. Check quantity and required fields.' });
    }

    return next(error);
  }
});

async function getCategories() {
  const result = await pool.query(`
    select
      id,
      name,
      slug,
      description,
      sort_order as "sortOrder",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from product_categories
    where is_active = true
    order by sort_order asc, lower(name) asc
  `);

  return result.rows;
}

async function getLocations() {
  const result = await pool.query(`
    select
      id,
      name,
      location_code as "locationCode",
      description,
      sort_order as "sortOrder",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from inventory_locations
    where is_active = true
    order by sort_order asc, lower(name) asc
  `);

  return result.rows;
}

function buildProductFilters(query) {
  const conditions = [];
  const values = [];
  const includeArchived = readBoolean(query.includeArchived || query.include_archived);

  if (!includeArchived) {
    conditions.push("(p.archived_at is null and p.status <> 'archived')");
  }

  const search = cleanText(query.search, { maxLength: 160 });

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      p.name ilike $${index}
      or coalesce(p.internal_sku, '') ilike $${index}
      or coalesce(p.brand, '') ilike $${index}
      or coalesce(p.manufacturer, '') ilike $${index}
      or coalesce(p.model, '') ilike $${index}
    )`);
  }

  const categoryId = readOptionalUuid(query.categoryId || query.category_id);

  if (categoryId) {
    values.push(categoryId);
    conditions.push(`p.category_id = $${values.length}`);
  }

  const status = cleanText(query.status, { maxLength: 80 });

  if (status && status !== 'all' && PRODUCT_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`p.status = $${values.length}`);
  }

  const productType = cleanText(query.productType || query.product_type, { maxLength: 80 });

  if (productType && productType !== 'all' && PRODUCT_TYPES.has(productType)) {
    values.push(productType);
    conditions.push(`p.product_type = $${values.length}`);
  }

  const locationId = readOptionalUuid(query.locationId || query.location_id);

  if (locationId) {
    values.push(locationId);
    conditions.push(`exists (
      select 1
      from product_inventory pi_location
      where pi_location.product_id = p.id
        and pi_location.location_id = $${values.length}
    )`);
  }

  const inventoryTracked = parseBooleanFilter(query.inventoryTracked || query.inventory_tracked);

  if (inventoryTracked !== null) {
    values.push(inventoryTracked);
    conditions.push(`p.inventory_tracking_enabled = $${values.length}`);
  }

  const taxable = parseBooleanFilter(query.taxable || query.isTaxable || query.is_taxable);

  if (taxable !== null) {
    values.push(taxable);
    conditions.push(`p.is_taxable = $${values.length}`);
  }

  const lowStock = parseBooleanFilter(query.lowStock || query.low_stock);

  if (lowStock === true) {
    conditions.push(`p.inventory_tracking_enabled = true`);
    conditions.push(`exists (
      select 1
      from product_inventory pi_low
      where pi_low.product_id = p.id
        and pi_low.low_stock_threshold is not null
        and pi_low.quantity_on_hand <= pi_low.low_stock_threshold
    )`);
  } else if (lowStock === false) {
    conditions.push(`not exists (
      select 1
      from product_inventory pi_low
      where pi_low.product_id = p.id
        and pi_low.low_stock_threshold is not null
        and pi_low.quantity_on_hand <= pi_low.low_stock_threshold
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

function buildInventoryFilters(query) {
  const conditions = [];
  const values = [];
  const includeArchived = readBoolean(query.includeArchived || query.include_archived);

  if (!includeArchived) {
    conditions.push("(p.archived_at is null and p.status <> 'archived')");
  }

  const productId = readOptionalUuid(query.productId || query.product_id);

  if (productId) {
    values.push(productId);
    conditions.push(`pi.product_id = $${values.length}`);
  }

  const locationId = readOptionalUuid(query.locationId || query.location_id);

  if (locationId) {
    values.push(locationId);
    conditions.push(`pi.location_id = $${values.length}`);
  }

  const confidence = cleanText(query.inventoryConfidence || query.inventory_confidence, { maxLength: 80 });

  if (confidence && INVENTORY_CONFIDENCE_VALUES.has(confidence)) {
    values.push(confidence);
    conditions.push(`pi.inventory_confidence = $${values.length}`);
  }

  const lowStock = parseBooleanFilter(query.lowStock || query.low_stock);

  if (lowStock === true) {
    conditions.push(`p.inventory_tracking_enabled = true`);
    conditions.push(`pi.low_stock_threshold is not null`);
    conditions.push(`pi.quantity_on_hand <= pi.low_stock_threshold`);
  } else if (lowStock === false) {
    conditions.push(`(
      pi.low_stock_threshold is null
      or pi.quantity_on_hand > pi.low_stock_threshold
      or p.inventory_tracking_enabled = false
    )`);
  }

  return {
    whereSql: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
    values
  };
}

async function getProductById(id) {
  const result = await pool.query(
    `
      ${productSelectSql}
      where p.id = $1
      group by p.id, c.id
      limit 1
    `,
    [id]
  );

  return result.rows[0] ? formatProduct(result.rows[0]) : null;
}

async function insertProduct(data) {
  const result = await pool.query(
    `
      insert into products (
        category_id,
        name,
        internal_sku,
        brand,
        manufacturer,
        model,
        product_type,
        status,
        short_description,
        staff_notes,
        stock_unit,
        inventory_tracking_enabled,
        is_taxable,
        cost_cents,
        retail_price_cents,
        msrp_cents,
        archived_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        case when $8 = 'archived' then now() else null end
      )
      returning id
    `,
    [
      data.categoryId,
      data.name,
      data.internalSku,
      data.brand,
      data.manufacturer,
      data.model,
      data.productType,
      data.status,
      data.shortDescription,
      data.staffNotes,
      data.stockUnit,
      data.inventoryTrackingEnabled,
      data.isTaxable,
      data.costCents,
      data.retailPriceCents,
      data.msrpCents
    ]
  );

  return getProductById(result.rows[0].id);
}

async function updateProduct(id, existing, data) {
  const archivedAt =
    data.status === 'archived'
      ? existing.archivedAt || new Date()
      : existing.status === 'archived'
        ? null
        : existing.archivedAt;

  await pool.query(
    `
      update products
      set
        category_id = $1,
        name = $2,
        internal_sku = $3,
        brand = $4,
        manufacturer = $5,
        model = $6,
        product_type = $7,
        status = $8,
        short_description = $9,
        staff_notes = $10,
        stock_unit = $11,
        inventory_tracking_enabled = $12,
        is_taxable = $13,
        cost_cents = $14,
        retail_price_cents = $15,
        msrp_cents = $16,
        archived_at = $17
      where id = $18
    `,
    [
      data.categoryId,
      data.name,
      data.internalSku,
      data.brand,
      data.manufacturer,
      data.model,
      data.productType,
      data.status,
      data.shortDescription,
      data.staffNotes,
      data.stockUnit,
      data.inventoryTrackingEnabled,
      data.isTaxable,
      data.costCents,
      data.retailPriceCents,
      data.msrpCents,
      archivedAt,
      id
    ]
  );

  return getProductById(id);
}

async function archiveProduct(id) {
  const result = await pool.query(
    `
      update products
      set archived_at = coalesce(archived_at, now()),
          status = 'archived'
      where id = $1
      returning id
    `,
    [id]
  );

  return result.rows[0] ? getProductById(id) : null;
}

async function reactivateProduct(id) {
  const result = await pool.query(
    `
      update products
      set archived_at = null,
          status = 'active'
      where id = $1
      returning id
    `,
    [id]
  );

  return result.rows[0] ? getProductById(id) : null;
}

async function normalizeProductInput(rawInput, existing) {
  const input = rawInput || {};
  const data = {
    name: readClean(input, existing, 'name', { maxLength: 220 }),
    categoryId: readClean(input, existing, 'categoryId', { maxLength: 80 }),
    internalSku: readClean(input, existing, 'internalSku', { maxLength: 120 }),
    brand: readClean(input, existing, 'brand', { maxLength: 160 }),
    manufacturer: readClean(input, existing, 'manufacturer', { maxLength: 160 }),
    model: readClean(input, existing, 'model', { maxLength: 160 }),
    productType: readClean(input, existing, 'productType', { maxLength: 80 }) || 'physical_product',
    status: readClean(input, existing, 'status', { maxLength: 80 }) || 'draft',
    shortDescription: readClean(input, existing, 'shortDescription', { maxLength: MAX_TEXT_LENGTH }),
    staffNotes: readClean(input, existing, 'staffNotes', { maxLength: MAX_TEXT_LENGTH }),
    stockUnit: readClean(input, existing, 'stockUnit', { maxLength: 80 }) || 'each',
    inventoryTrackingEnabled: readExistingBoolean(input, existing, 'inventoryTrackingEnabled', false),
    isTaxable: readExistingBoolean(input, existing, 'isTaxable', true),
    costCents: readMoney(input, existing, 'cost'),
    retailPriceCents: readMoney(input, existing, 'retailPrice'),
    msrpCents: readMoney(input, existing, 'msrp')
  };

  const validationError = validateProductData(data);

  if (validationError) {
    return { error: validationError };
  }

  const categoryExists = await productCategoryExists(data.categoryId);

  if (!categoryExists) {
    return { error: 'Choose an active product category.' };
  }

  const duplicateSku = await internalSkuExists(data.internalSku, existing?.id || null);

  if (duplicateSku) {
    return { error: 'Internal SKU/code is already used by another product.' };
  }

  return { data };
}

function validateProductData(data) {
  if (!data.name) {
    return 'Product name is required.';
  }

  if (!readUuid(data.categoryId)) {
    return 'Choose a valid product category.';
  }

  if (!PRODUCT_TYPES.has(data.productType)) {
    return 'Choose a valid product type.';
  }

  if (!PRODUCT_STATUSES.has(data.status)) {
    return 'Choose a valid product status.';
  }

  if (data.inventoryTrackingEnabled && !data.stockUnit) {
    return 'Stock unit is required when inventory tracking is enabled.';
  }

  if (!STOCK_UNITS.has(data.stockUnit)) {
    return 'Choose a valid stock unit.';
  }

  for (const [fieldName, label] of [
    ['costCents', 'Cost'],
    ['retailPriceCents', 'Retail price'],
    ['msrpCents', 'MSRP']
  ]) {
    const value = data[fieldName];

    if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_MONEY_CENTS)) {
      return `${label} must be a non-negative CAD amount.`;
    }
  }

  return '';
}

async function productCategoryExists(categoryId) {
  const result = await pool.query(
    `
      select id
      from product_categories
      where id = $1
        and is_active = true
      limit 1
    `,
    [categoryId]
  );

  return result.rowCount === 1;
}

async function internalSkuExists(internalSku, exceptProductId) {
  if (!internalSku) {
    return false;
  }

  const result = await pool.query(
    `
      select id
      from products
      where lower(internal_sku) = lower($1)
        and ($2::uuid is null or id <> $2::uuid)
      limit 1
    `,
    [internalSku, exceptProductId]
  );

  return result.rowCount > 0;
}

function normalizeAdjustmentInput(input) {
  const productId = readUuid(getInput(input, 'productId'));
  const locationId = readUuid(getInput(input, 'locationId'));
  const adjustmentType = cleanText(getInput(input, 'adjustmentType'), { maxLength: 80 });
  const quantityDelta = parseQuantity(getInput(input, 'quantityDelta'));
  const reason = cleanText(getInput(input, 'reason'), { maxLength: MAX_SHORT_TEXT_LENGTH });
  const notes = cleanText(getInput(input, 'notes'), { maxLength: MAX_TEXT_LENGTH });
  const inventoryConfidence = cleanText(getInput(input, 'inventoryConfidence'), { maxLength: 80 });
  const lowStockThresholdProvided = hasInput(input, 'lowStockThreshold');
  const lastCountedAtProvided = hasInput(input, 'lastCountedAt');
  const lowStockThreshold = lowStockThresholdProvided
    ? parseQuantity(getInput(input, 'lowStockThreshold'), { nullable: true })
    : undefined;
  const lastCountedAt = lastCountedAtProvided
    ? parseNullableDate(getInput(input, 'lastCountedAt'))
    : undefined;

  if (!productId) {
    return { error: 'Choose a valid product.' };
  }

  if (!locationId) {
    return { error: 'Choose a valid inventory location.' };
  }

  if (!ADJUSTMENT_TYPES.has(adjustmentType)) {
    return { error: 'Choose a valid adjustment type.' };
  }

  if (adjustmentType === 'location_transfer') {
    return { error: 'Use a dedicated transfer workflow for location transfers.' };
  }

  if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
    return { error: 'Quantity delta must be a non-zero number.' };
  }

  if (Math.abs(quantityDelta) > MAX_QUANTITY) {
    return { error: 'Quantity delta is too large.' };
  }

  if (!reason) {
    return { error: 'Reason is required.' };
  }

  if (inventoryConfidence && !INVENTORY_CONFIDENCE_VALUES.has(inventoryConfidence)) {
    return { error: 'Choose a valid inventory confidence value.' };
  }

  if (lowStockThresholdProvided && lowStockThreshold !== null) {
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > MAX_QUANTITY) {
      return { error: 'Low stock threshold must be zero or greater.' };
    }
  }

  if (lastCountedAtProvided && lastCountedAt === false) {
    return { error: 'Last counted date is not valid.' };
  }

  return {
    data: {
      productId,
      locationId,
      adjustmentType,
      quantityDelta,
      reason,
      notes,
      inventoryConfidence: inventoryConfidence || undefined,
      lowStockThreshold,
      lowStockThresholdProvided,
      lastCountedAt,
      lastCountedAtProvided
    }
  };
}

async function createInventoryAdjustment(data, adjustedBy) {
  const client = await pool.connect();

  try {
    await client.query('begin');

    const productResult = await client.query(
      `
        select id, name, inventory_tracking_enabled as "inventoryTrackingEnabled", archived_at as "archivedAt"
        from products
        where id = $1
        limit 1
      `,
      [data.productId]
    );
    const product = productResult.rows[0];

    if (!product || product.archivedAt) {
      await client.query('rollback');
      return { error: 'Product is unavailable for inventory adjustment.' };
    }

    if (!product.inventoryTrackingEnabled) {
      await client.query('rollback');
      return { error: 'Inventory adjustments require inventory tracking to be enabled for this product.' };
    }

    const locationResult = await client.query(
      `
        select id
        from inventory_locations
        where id = $1
          and is_active = true
        limit 1
      `,
      [data.locationId]
    );

    if (locationResult.rowCount !== 1) {
      await client.query('rollback');
      return { error: 'Inventory location is unavailable.' };
    }

    await client.query(
      `
        insert into product_inventory (
          product_id,
          location_id,
          quantity_on_hand,
          low_stock_threshold,
          inventory_confidence,
          last_counted_at
        )
        values ($1, $2, 0, $3, $4, $5)
        on conflict (product_id, location_id) do nothing
      `,
      [
        data.productId,
        data.locationId,
        data.lowStockThresholdProvided ? data.lowStockThreshold : null,
        data.inventoryConfidence || 'unverified',
        data.lastCountedAtProvided ? data.lastCountedAt : null
      ]
    );

    const inventoryResult = await client.query(
      `
        select
          id,
          product_id as "productId",
          location_id as "locationId",
          quantity_on_hand as "quantityOnHand",
          low_stock_threshold as "lowStockThreshold",
          inventory_confidence as "inventoryConfidence",
          last_counted_at as "lastCountedAt",
          notes,
          created_at as "createdAt",
          updated_at as "updatedAt"
        from product_inventory
        where product_id = $1
          and location_id = $2
        for update
      `,
      [data.productId, data.locationId]
    );
    const inventory = inventoryResult.rows[0];
    const quantityBefore = parseQuantity(inventory.quantityOnHand);
    const quantityAfter = roundQuantity(quantityBefore + data.quantityDelta);

    if (quantityAfter < 0) {
      await client.query('rollback');
      return { error: 'Inventory adjustment would create a negative quantity.' };
    }

    const updateAssignments = ['quantity_on_hand = $1'];
    const updateValues = [quantityAfter];

    if (data.lowStockThresholdProvided) {
      updateValues.push(data.lowStockThreshold);
      updateAssignments.push(`low_stock_threshold = $${updateValues.length}`);
    }

    if (data.inventoryConfidence) {
      updateValues.push(data.inventoryConfidence);
      updateAssignments.push(`inventory_confidence = $${updateValues.length}`);
    }

    if (data.lastCountedAtProvided) {
      updateValues.push(data.lastCountedAt);
      updateAssignments.push(`last_counted_at = $${updateValues.length}`);
    }

    updateValues.push(data.productId, data.locationId);

    const updatedInventoryResult = await client.query(
      `
        update product_inventory
        set ${updateAssignments.join(', ')}
        where product_id = $${updateValues.length - 1}
          and location_id = $${updateValues.length}
        returning
          id,
          product_id as "productId",
          location_id as "locationId",
          quantity_on_hand as "quantityOnHand",
          low_stock_threshold as "lowStockThreshold",
          inventory_confidence as "inventoryConfidence",
          last_counted_at as "lastCountedAt",
          notes,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `,
      updateValues
    );

    const adjustmentResult = await client.query(
      `
        insert into inventory_adjustments (
          product_id,
          location_id,
          adjustment_type,
          quantity_before,
          quantity_delta,
          quantity_after,
          reason,
          notes,
          adjusted_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning
          id,
          product_id as "productId",
          location_id as "locationId",
          adjustment_type as "adjustmentType",
          quantity_before as "quantityBefore",
          quantity_delta as "quantityDelta",
          quantity_after as "quantityAfter",
          reason,
          notes,
          adjustment_group_id as "adjustmentGroupId",
          adjusted_by as "adjustedBy",
          created_at as "createdAt"
      `,
      [
        data.productId,
        data.locationId,
        data.adjustmentType,
        quantityBefore,
        data.quantityDelta,
        quantityAfter,
        data.reason,
        data.notes,
        adjustedBy
      ]
    );

    await client.query('commit');

    return {
      adjustment: formatAdjustment(adjustmentResult.rows[0]),
      inventory: formatInventoryRow(updatedInventoryResult.rows[0])
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getAdjustments({ productId, locationId, adjustmentType, limit = 100 }) {
  const conditions = [];
  const values = [];

  if (productId) {
    values.push(productId);
    conditions.push(`ia.product_id = $${values.length}`);
  }

  if (locationId) {
    values.push(locationId);
    conditions.push(`ia.location_id = $${values.length}`);
  }

  if (adjustmentType) {
    values.push(adjustmentType);
    conditions.push(`ia.adjustment_type = $${values.length}`);
  }

  values.push(limit);
  const result = await pool.query(
    `
      select
        ia.id,
        ia.product_id as "productId",
        p.name as "productName",
        p.internal_sku as "internalSku",
        p.stock_unit as "stockUnit",
        ia.location_id as "locationId",
        il.name as "locationName",
        il.location_code as "locationCode",
        ia.adjustment_type as "adjustmentType",
        ia.quantity_before as "quantityBefore",
        ia.quantity_delta as "quantityDelta",
        ia.quantity_after as "quantityAfter",
        ia.reason,
        ia.notes,
        ia.adjustment_group_id as "adjustmentGroupId",
        ia.adjusted_by as "adjustedBy",
        ia.created_at as "createdAt"
      from inventory_adjustments ia
      join products p on p.id = ia.product_id
      join inventory_locations il on il.id = ia.location_id
      ${conditions.length > 0 ? `where ${conditions.join(' and ')}` : ''}
      order by ia.created_at desc
      limit $${values.length}
    `,
    values
  );

  return result.rows.map(formatAdjustment);
}

function formatProduct(product) {
  const inventory = Array.isArray(product.inventory)
    ? product.inventory.map((row) => formatInventoryRow(row, product))
    : [];

  return {
    ...product,
    inventory,
    isArchived: Boolean(product.archivedAt || product.status === 'archived'),
    costCents: nullableNumber(product.costCents),
    retailPriceCents: nullableNumber(product.retailPriceCents),
    msrpCents: nullableNumber(product.msrpCents),
    formattedCost: formatCents(product.costCents),
    formattedRetailPrice: formatCents(product.retailPriceCents),
    formattedMsrp: formatCents(product.msrpCents),
    inventorySummary: summarizeProductInventory({
      ...product,
      inventory
    })
  };
}

function formatInventoryRow(row, product = {}) {
  const quantityOnHand = parseQuantity(row.quantityOnHand);
  const lowStockThreshold = row.lowStockThreshold === null || row.lowStockThreshold === undefined
    ? null
    : parseQuantity(row.lowStockThreshold);

  return {
    ...row,
    productId: row.productId || product.id || null,
    productName: row.productName || product.name || null,
    internalSku: row.internalSku || product.internalSku || null,
    stockUnit: row.stockUnit || product.stockUnit || null,
    inventoryTrackingEnabled: row.inventoryTrackingEnabled ?? product.inventoryTrackingEnabled ?? true,
    quantityOnHand,
    lowStockThreshold,
    isLowStock: Boolean(
      (row.inventoryTrackingEnabled ?? product.inventoryTrackingEnabled ?? true) &&
      lowStockThreshold !== null &&
      quantityOnHand <= lowStockThreshold
    )
  };
}

function formatAdjustment(row) {
  return {
    ...row,
    quantityBefore: parseQuantity(row.quantityBefore),
    quantityDelta: parseQuantity(row.quantityDelta),
    quantityAfter: parseQuantity(row.quantityAfter)
  };
}

function summarizeProductInventory(product) {
  if (!product.inventoryTrackingEnabled) {
    return {
      label: 'Not tracked',
      totalQuantityOnHand: null,
      trackedLocationCount: 0,
      lowStockLocationCount: 0
    };
  }

  const inventory = Array.isArray(product.inventory) ? product.inventory : [];
  const totalQuantityOnHand = roundQuantity(
    inventory.reduce((sum, row) => sum + parseQuantity(row.quantityOnHand), 0)
  );
  const lowStockLocationCount = inventory.filter((row) => row.isLowStock).length;

  return {
    label: `${formatQuantity(totalQuantityOnHand)} ${product.stockUnit || 'unit'}`,
    totalQuantityOnHand,
    trackedLocationCount: inventory.length,
    lowStockLocationCount
  };
}

function summarizeProducts(products) {
  return {
    productCount: products.length,
    trackedCount: products.filter((product) => product.inventoryTrackingEnabled).length,
    lowStockCount: products.filter((product) => product.inventorySummary.lowStockLocationCount > 0).length,
    reviewCount: products.filter((product) => product.status === 'review_needed').length,
    archivedCount: products.filter((product) => product.isArchived).length
  };
}

function toOptionObjects(entries) {
  return entries.map(([value, label]) => ({ value, label }));
}

function readClean(input, existing, fieldName, options = {}) {
  if (hasInput(input, fieldName)) {
    return cleanText(getInput(input, fieldName), options);
  }

  if (existing) {
    return existing[fieldName] ?? null;
  }

  return null;
}

function cleanText(value, options = {}) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, options.maxLength || MAX_TEXT_LENGTH);
}

function readMoney(input, existing, prefix) {
  const centsField = `${prefix}Cents`;
  const dollarsField = `${prefix}Dollars`;

  if (hasInput(input, centsField)) {
    return parseCents(getInput(input, centsField));
  }

  if (hasInput(input, dollarsField)) {
    return parseDollars(getInput(input, dollarsField));
  }

  if (existing) {
    return existing[centsField] ?? null;
  }

  return null;
}

function parseCents(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number)) {
    return NaN;
  }

  return number;
}

function parseDollars(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).replace(/[$,\s]/g, '');
  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return NaN;
  }

  return Math.round(number * 100);
}

function readExistingBoolean(input, existing, fieldName, fallback) {
  if (hasInput(input, fieldName)) {
    return readBoolean(getInput(input, fieldName));
  }

  if (existing) {
    return Boolean(existing[fieldName]);
  }

  return fallback;
}

function readBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value || '').trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off', ''].includes(normalized)) {
    return false;
  }

  return false;
}

function parseBooleanFilter(value) {
  if (value === undefined || value === null || value === '' || value === 'all') {
    return null;
  }

  return readBoolean(value);
}

function parseQuantity(value, options = {}) {
  if ((value === '' || value === null || value === undefined) && options.nullable) {
    return null;
  }

  const normalized = String(value ?? '').replace(/,/g, '').trim();
  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return NaN;
  }

  return roundQuantity(number);
}

function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function parseNullableDate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date;
}

function parseLimit(value, fallback) {
  const number = Number(value || fallback);

  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }

  return Math.min(number, 200);
}

function readUuid(value) {
  const normalized = cleanText(value, { maxLength: 80 });
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
}

function readOptionalUuid(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return readUuid(value);
}

function hasInput(input, fieldName) {
  return Object.prototype.hasOwnProperty.call(input, fieldName) ||
    Object.prototype.hasOwnProperty.call(input, toSnakeCase(fieldName));
}

function getInput(input, fieldName) {
  if (Object.prototype.hasOwnProperty.call(input, fieldName)) {
    return input[fieldName];
  }

  return input[toSnakeCase(fieldName)];
}

function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatCents(cents) {
  if (cents === null || cents === undefined) {
    return 'Not set';
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(Number(cents || 0) / 100);
}

function isValidationConstraintError(error) {
  return error.code === '23514' || error.code === '23503' || error.code === '22P02';
}
