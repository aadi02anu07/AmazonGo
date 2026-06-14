/**
 * Amazon Now Snap — Dev Data Seed Script
 *
 * Populates local DynamoDB tables with representative seed data for development.
 * Run via:  npm run seed:dev
 *
 * Design principles:
 *  - Idempotent: uses a ConditionExpression so re-running never overwrites existing items
 *  - Uses the shared docClient singleton (respects DYNAMODB_ENDPOINT env var automatically)
 *  - No console.log — all output goes through the structured logger
 *
 * Requirements: 5.7, 5.8, 5.9
 */

// Load .env before any other imports so DYNAMODB_ENDPOINT is available to dynamoClient.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from '../src/clients/dynamoClient';
import { logger } from '../src/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableStats {
  inserted: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Per-table counters
// ---------------------------------------------------------------------------

const stats = new Map<string, TableStats>();

function getStats(tableName: string): TableStats {
  if (!stats.has(tableName)) {
    stats.set(tableName, { inserted: 0, skipped: 0 });
  }
  // We just set it above if absent, so the cast is safe
  return stats.get(tableName) as TableStats;
}

// ---------------------------------------------------------------------------
// Idempotent write helper
//
// Writes `item` to `tableName`.  If an item with the same primary-key value
// already exists the write is silently skipped (idempotent).  Any other error
// is re-thrown so the caller can handle it.
//
// @param tableName  DynamoDB table name
// @param item       Full item to put
// @param pkAttr     Name of the partition-key attribute used in the condition
// ---------------------------------------------------------------------------

export async function seedItem(
  tableName: string,
  item: Record<string, unknown>,
  pkAttr: string,
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: { '#pk': pkAttr },
      }),
    );
    getStats(tableName).inserted += 1;
  } catch (err: unknown) {
    // ConditionalCheckFailedException means the item already exists — skip it
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ConditionalCheckFailedException'
    ) {
      getStats(tableName).skipped += 1;
      return;
    }
    // All other errors bubble up
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Summary logger
// ---------------------------------------------------------------------------

function logSummary(): void {
  const summary: Record<string, TableStats> = {};
  for (const [table, counts] of stats.entries()) {
    summary[table] = counts;
  }
  logger.info({
    message: 'Seed complete',
    tables: summary,
  });
}

// ---------------------------------------------------------------------------
// Main entry point
//
// Subsequent tasks (3.2 – 3.5) will add seed calls here, one section per
// table.  Keep each table block clearly delimited so diffs stay small.
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  logger.info({ message: 'Starting dev data seed', endpoint: process.env.DYNAMODB_ENDPOINT ?? 'aws' });

  // ── Users (task 3.2) ──────────────────────────────────────────────────────
  const users: Array<Record<string, unknown>> = [
    {
      userId: 'test_user_new',
      email: 'test_new@snap.dev',
      totalOrders: 0,
      smartCartTier: 'trending',
      defaultPincode: '110024',
      notificationsEnabled: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'test_user_light',
      email: 'test_light@snap.dev',
      totalOrders: 8,
      smartCartTier: 'hybrid',
      defaultPincode: '110024',
      notificationsEnabled: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'test_user_regular',
      email: 'test_regular@snap.dev',
      totalOrders: 35,
      smartCartTier: 'personalize',
      defaultPincode: '560034',
      notificationsEnabled: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'test_user_power',
      email: 'test_power@snap.dev',
      totalOrders: 120,
      smartCartTier: 'personalize',
      defaultPincode: '400050',
      notificationsEnabled: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'test_user_empty',
      email: 'test_empty@snap.dev',
      totalOrders: 0,
      smartCartTier: 'trending',
      defaultPincode: '110024',
      notificationsEnabled: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const user of users) {
    await seedItem(TABLE_NAMES.USERS, user, 'userId');
  }

  // ── Products / Inventory (task 3.3) ──────────────────────────────────────
  const products: Array<Record<string, unknown>> = [
    // ── GROCERY (15 products) ──────────────────────────────────────────────
    {
      productId: 'prod_amul_milk_500',
      sku: 'SKU-AMK-500',
      name: 'Amul Gold Milk 500ml',
      brand: 'Amul',
      category: 'grocery',
      subCategory: 'dairy',
      description: 'Fresh pasteurized Amul Gold Milk',
      imageUrls: ['https://cdn.snap.dev/products/amul-milk-500.jpg'],
      price: 3200,
      mrp: 3500,
      unit: '500ml',
      tags: ['milk', 'dairy', 'amul', 'gold', '500ml'],
      weight: '500g',
      barcodes: ['8901396047919'],
      rekognitionLabels: ['Milk', 'Dairy', 'Bottle'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_amul_milk_1l',
      sku: 'SKU-AMK-1L',
      name: 'Amul Gold Milk 1L',
      brand: 'Amul',
      category: 'grocery',
      subCategory: 'dairy',
      description: 'Fresh pasteurized Amul Gold Milk 1 litre',
      imageUrls: ['https://cdn.snap.dev/products/amul-milk-1l.jpg'],
      price: 6400,
      mrp: 7000,
      unit: '1L',
      tags: ['milk', 'dairy', 'amul', 'gold', '1litre'],
      weight: '1kg',
      barcodes: ['8901396048169'],
      rekognitionLabels: ['Milk', 'Dairy', 'Bottle'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_britannia_bread',
      sku: 'SKU-BRB-WWB',
      name: 'Britannia Whole Wheat Bread',
      brand: 'Britannia',
      category: 'grocery',
      subCategory: 'bread',
      description: 'Whole wheat bread loaf',
      imageUrls: ['https://cdn.snap.dev/products/britannia-bread.jpg'],
      price: 4500,
      mrp: 5000,
      unit: '400g',
      tags: ['bread', 'wheat', 'britannia', 'loaf', 'sandwich'],
      weight: '400g',
      barcodes: ['8901063154261'],
      rekognitionLabels: ['Bread', 'Loaf', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_eggs_6',
      sku: 'SKU-EGG-6PK',
      name: 'Eggs (6 pack)',
      brand: 'Farm Fresh',
      category: 'grocery',
      subCategory: 'eggs',
      description: 'Fresh farm eggs pack of 6',
      imageUrls: ['https://cdn.snap.dev/products/eggs-6.jpg'],
      price: 7000,
      mrp: 7500,
      unit: '6 pack',
      tags: ['eggs', 'protein', 'fresh', '6pack', 'dozen'],
      weight: '300g',
      barcodes: ['5010126001671'],
      rekognitionLabels: ['Egg', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_eggs_12',
      sku: 'SKU-EGG-12PK',
      name: 'Eggs (12 pack)',
      brand: 'Farm Fresh',
      category: 'grocery',
      subCategory: 'eggs',
      description: 'Fresh farm eggs pack of 12',
      imageUrls: ['https://cdn.snap.dev/products/eggs-12.jpg'],
      price: 13000,
      mrp: 14000,
      unit: '12 pack',
      tags: ['eggs', 'protein', 'fresh', '12pack', 'dozen'],
      weight: '600g',
      barcodes: ['5010126001688'],
      rekognitionLabels: ['Egg', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_india_gate_rice_1kg',
      sku: 'SKU-IGR-1KG',
      name: 'India Gate Basmati Rice 1kg',
      brand: 'India Gate',
      category: 'grocery',
      subCategory: 'rice',
      description: 'Premium basmati rice',
      imageUrls: ['https://cdn.snap.dev/products/india-gate-rice.jpg'],
      price: 12000,
      mrp: 13500,
      unit: '1kg',
      tags: ['rice', 'basmati', 'india gate', '1kg', 'grain'],
      weight: '1kg',
      barcodes: ['8906004100045'],
      rekognitionLabels: ['Rice', 'Grain', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_toor_dal_500g',
      sku: 'SKU-TDA-500',
      name: 'Tata Sampann Toor Dal 500g',
      brand: 'Tata Sampann',
      category: 'grocery',
      subCategory: 'pulses',
      description: 'Premium toor dal',
      imageUrls: ['https://cdn.snap.dev/products/toor-dal.jpg'],
      price: 8500,
      mrp: 9500,
      unit: '500g',
      tags: ['dal', 'toor', 'lentil', 'protein', 'tata'],
      weight: '500g',
      barcodes: ['8901030812323'],
      rekognitionLabels: ['Dal', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_fortune_oil_1l',
      sku: 'SKU-FOS-1L',
      name: 'Fortune Sunflower Oil 1L',
      brand: 'Fortune',
      category: 'grocery',
      subCategory: 'oils',
      description: 'Refined sunflower cooking oil',
      imageUrls: ['https://cdn.snap.dev/products/fortune-oil.jpg'],
      price: 15500,
      mrp: 17000,
      unit: '1L',
      tags: ['oil', 'sunflower', 'fortune', 'cooking', '1litre'],
      weight: '900g',
      barcodes: ['8906003200094'],
      rekognitionLabels: ['Oil', 'Bottle'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_amul_butter_100g',
      sku: 'SKU-AMB-100',
      name: 'Amul Butter 100g',
      brand: 'Amul',
      category: 'grocery',
      subCategory: 'dairy',
      description: 'Pasteurized butter',
      imageUrls: ['https://cdn.snap.dev/products/amul-butter.jpg'],
      price: 5500,
      mrp: 6000,
      unit: '100g',
      tags: ['butter', 'amul', 'dairy', 'spread', '100g'],
      weight: '100g',
      barcodes: ['8901396030218'],
      rekognitionLabels: ['Butter', 'Dairy'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_nestle_dahi_400g',
      sku: 'SKU-NDH-400',
      name: 'Nestle Dahi 400g',
      brand: 'Nestle',
      category: 'grocery',
      subCategory: 'dairy',
      description: 'Fresh set curd',
      imageUrls: ['https://cdn.snap.dev/products/nestle-dahi.jpg'],
      price: 4000,
      mrp: 4500,
      unit: '400g',
      tags: ['curd', 'dahi', 'yogurt', 'nestle', '400g'],
      weight: '400g',
      barcodes: ['8901058501028'],
      rekognitionLabels: ['Yogurt', 'Dairy'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_tomatoes_500g',
      sku: 'SKU-TOM-500',
      name: 'Fresh Tomatoes 500g',
      brand: 'Farm Fresh',
      category: 'grocery',
      subCategory: 'vegetables',
      description: 'Fresh red tomatoes',
      imageUrls: ['https://cdn.snap.dev/products/tomatoes.jpg'],
      price: 3000,
      mrp: 3500,
      unit: '500g',
      tags: ['tomatoes', 'fresh', 'vegetable', '500g'],
      weight: '500g',
      barcodes: ['0000000000001'],
      rekognitionLabels: ['Tomato', 'Vegetable', 'Red'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_onions_1kg',
      sku: 'SKU-ONI-1KG',
      name: 'Onions 1kg',
      brand: 'Farm Fresh',
      category: 'grocery',
      subCategory: 'vegetables',
      description: 'Fresh red onions',
      imageUrls: ['https://cdn.snap.dev/products/onions.jpg'],
      price: 4500,
      mrp: 5000,
      unit: '1kg',
      tags: ['onion', 'vegetable', '1kg', 'fresh'],
      weight: '1kg',
      barcodes: ['0000000000002'],
      rekognitionLabels: ['Onion', 'Vegetable'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_sugar_1kg',
      sku: 'SKU-TSU-1KG',
      name: 'Tata Sugar 1kg',
      brand: 'Tata',
      category: 'grocery',
      subCategory: 'sugar',
      description: 'Refined white sugar',
      imageUrls: ['https://cdn.snap.dev/products/tata-sugar.jpg'],
      price: 4800,
      mrp: 5200,
      unit: '1kg',
      tags: ['sugar', 'tata', '1kg', 'white sugar'],
      weight: '1kg',
      barcodes: ['8901058820018'],
      rekognitionLabels: ['Sugar', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_salt_1kg',
      sku: 'SKU-TSL-1KG',
      name: 'Tata Salt 1kg',
      brand: 'Tata',
      category: 'grocery',
      subCategory: 'salt',
      description: 'Iodized salt',
      imageUrls: ['https://cdn.snap.dev/products/tata-salt.jpg'],
      price: 2200,
      mrp: 2500,
      unit: '1kg',
      tags: ['salt', 'tata', 'iodized', '1kg'],
      weight: '1kg',
      barcodes: ['8901058809013'],
      rekognitionLabels: ['Salt', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_atta_5kg',
      sku: 'SKU-AAT-5KG',
      name: 'Aashirvaad Atta 5kg',
      brand: 'Aashirvaad',
      category: 'grocery',
      subCategory: 'flour',
      description: 'Whole wheat flour',
      imageUrls: ['https://cdn.snap.dev/products/aashirvaad-atta.jpg'],
      price: 28000,
      mrp: 31000,
      unit: '5kg',
      tags: ['atta', 'flour', 'wheat', 'aashirvaad', '5kg', 'chapati'],
      weight: '5kg',
      barcodes: ['8901030819858'],
      rekognitionLabels: ['Flour', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // ── MEDICINE (10 products) ─────────────────────────────────────────────
    {
      productId: 'prod_crocin_10',
      sku: 'SKU-CRO-10T',
      name: 'Crocin 500mg (10 tablets)',
      brand: 'GSK',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Paracetamol 500mg tablets',
      imageUrls: ['https://cdn.snap.dev/products/crocin.jpg'],
      price: 3200,
      mrp: 3500,
      unit: '10 tablets',
      tags: ['paracetamol', 'fever', 'crocin', 'pain relief', 'tablet', '500mg'],
      weight: '15g',
      barcodes: ['8901516103018'],
      rekognitionLabels: ['Medicine', 'Tablet'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_calpol_syrup',
      sku: 'SKU-CAL-SYR',
      name: 'Calpol 120ml Syrup',
      brand: 'GSK',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Paracetamol syrup for children',
      imageUrls: ['https://cdn.snap.dev/products/calpol.jpg'],
      price: 8900,
      mrp: 9500,
      unit: '120ml',
      tags: ['paracetamol', 'fever', 'children', 'syrup', 'calpol', '120ml'],
      weight: '130g',
      barcodes: ['8901516132476'],
      rekognitionLabels: ['Medicine', 'Syrup', 'Bottle'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_disprin_10',
      sku: 'SKU-DIS-10T',
      name: 'Disprin 10 tablets',
      brand: 'Reckitt',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Aspirin tablets for headache',
      imageUrls: ['https://cdn.snap.dev/products/disprin.jpg'],
      price: 2500,
      mrp: 2800,
      unit: '10 tablets',
      tags: ['aspirin', 'headache', 'disprin', 'pain', 'fever', 'tablet'],
      weight: '15g',
      barcodes: ['8901514000117'],
      rekognitionLabels: ['Medicine', 'Tablet'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_ors_electral',
      sku: 'SKU-ORS-ELC',
      name: 'Electral ORS Powder',
      brand: 'Franco-Indian',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Oral rehydration solution powder',
      imageUrls: ['https://cdn.snap.dev/products/electral.jpg'],
      price: 3500,
      mrp: 4000,
      unit: '21.8g sachet',
      tags: ['ors', 'electral', 'dehydration', 'electrolytes', 'rehydration'],
      weight: '22g',
      barcodes: ['8904249900089'],
      rekognitionLabels: ['Medicine'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_vicks_50g',
      sku: 'SKU-VCK-50G',
      name: 'Vicks VapoRub 50g',
      brand: 'Vicks',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Medicated rub for cold and congestion',
      imageUrls: ['https://cdn.snap.dev/products/vicks.jpg'],
      price: 16500,
      mrp: 18000,
      unit: '50g',
      tags: ['vicks', 'cold', 'cough', 'nasal', 'vaporub', '50g'],
      weight: '50g',
      barcodes: ['8001841044125'],
      rekognitionLabels: ['Medicine', 'Cream'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_betadine_30ml',
      sku: 'SKU-BET-30ML',
      name: 'Betadine Antiseptic 30ml',
      brand: 'Win-Medicare',
      category: 'medicine',
      subCategory: 'first-aid',
      description: 'Povidone-iodine antiseptic solution',
      imageUrls: ['https://cdn.snap.dev/products/betadine.jpg'],
      price: 7500,
      mrp: 8200,
      unit: '30ml',
      tags: ['antiseptic', 'betadine', 'wound', 'iodine', 'first aid'],
      weight: '35g',
      barcodes: ['8906006210075'],
      rekognitionLabels: ['Medicine', 'Bottle'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_gelusil_10',
      sku: 'SKU-GEL-10T',
      name: 'Gelusil MPS 10 tablets',
      brand: 'Pfizer',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Antacid tablets for acidity',
      imageUrls: ['https://cdn.snap.dev/products/gelusil.jpg'],
      price: 5000,
      mrp: 5500,
      unit: '10 tablets',
      tags: ['antacid', 'gelusil', 'acidity', 'stomach', 'digestion'],
      weight: '20g',
      barcodes: ['8904109900130'],
      rekognitionLabels: ['Medicine', 'Tablet'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_zincovit_10',
      sku: 'SKU-ZCV-10T',
      name: 'Zincovit Tablets 10 pack',
      brand: 'Apex',
      category: 'medicine',
      subCategory: 'vitamins',
      description: 'Multivitamin and zinc supplement',
      imageUrls: ['https://cdn.snap.dev/products/zincovit.jpg'],
      price: 11000,
      mrp: 12000,
      unit: '10 tablets',
      tags: ['multivitamin', 'zinc', 'vitamin', 'zincovit', 'supplement'],
      weight: '20g',
      barcodes: ['8906059290020'],
      rekognitionLabels: ['Medicine', 'Tablet'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_iodex_8g',
      sku: 'SKU-IOD-8G',
      name: 'Iodex Balm 8g',
      brand: 'GSK',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Pain relief balm',
      imageUrls: ['https://cdn.snap.dev/products/iodex.jpg'],
      price: 5500,
      mrp: 6000,
      unit: '8g',
      tags: ['pain', 'muscle', 'iodex', 'balm', 'relief', 'joint'],
      weight: '8g',
      barcodes: ['8901516038532'],
      rekognitionLabels: ['Medicine', 'Cream'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_strepsils_8',
      sku: 'SKU-STR-8PK',
      name: 'Strepsils 8 lozenges',
      brand: 'Reckitt',
      category: 'medicine',
      subCategory: 'otc',
      description: 'Throat lozenges honey lemon',
      imageUrls: ['https://cdn.snap.dev/products/strepsils.jpg'],
      price: 7500,
      mrp: 8000,
      unit: '8 lozenges',
      tags: ['throat', 'strepsils', 'sore throat', 'lozenges', 'honey lemon'],
      weight: '24g',
      barcodes: ['8901514120045'],
      rekognitionLabels: ['Medicine', 'Lozenge'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // ── SNACKS & BEVERAGES (10 products) ──────────────────────────────────
    {
      productId: 'prod_lays_classic_26',
      sku: 'SKU-LAY-26',
      name: "Lay's Classic Salted 26g",
      brand: "Lay's",
      category: 'snacks',
      subCategory: 'chips',
      description: "Lay's classic salted potato chips",
      imageUrls: ['https://cdn.snap.dev/products/lays-classic.jpg'],
      price: 2000,
      mrp: 2000,
      unit: '26g',
      tags: ['chips', 'lays', 'snack', 'potato', 'salted'],
      weight: '26g',
      barcodes: ['8901499005619'],
      rekognitionLabels: ['Chips', 'Snack'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_kurkure_90',
      sku: 'SKU-KUR-90',
      name: 'Kurkure Masala Munch 90g',
      brand: 'Kurkure',
      category: 'snacks',
      subCategory: 'namkeen',
      description: 'Kurkure masala munch corn puffs',
      imageUrls: ['https://cdn.snap.dev/products/kurkure-90.jpg'],
      price: 2000,
      mrp: 2000,
      unit: '90g',
      tags: ['kurkure', 'snack', 'masala', 'corn puffs', 'namkeen'],
      weight: '90g',
      barcodes: ['8901491500212'],
      rekognitionLabels: ['Snack', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_good_day_120',
      sku: 'SKU-GDB-120',
      name: 'Britannia Good Day Butter Cookies 120g',
      brand: 'Britannia',
      category: 'snacks',
      subCategory: 'biscuits',
      description: 'Britannia Good Day butter cookies',
      imageUrls: ['https://cdn.snap.dev/products/good-day-120.jpg'],
      price: 3500,
      mrp: 4000,
      unit: '120g',
      tags: ['biscuit', 'cookies', 'good day', 'britannia', 'butter'],
      weight: '120g',
      barcodes: ['8901063072497'],
      rekognitionLabels: ['Cookie', 'Biscuit'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_maggi_2min',
      sku: 'SKU-MAG-4PK',
      name: 'Maggi 2 Minute Noodles (4 pack)',
      brand: 'Maggi',
      category: 'snacks',
      subCategory: 'noodles',
      description: 'Maggi 2 minute instant masala noodles 4 pack',
      imageUrls: ['https://cdn.snap.dev/products/maggi-2min.jpg'],
      price: 6800,
      mrp: 7600,
      unit: '4 pack',
      tags: ['maggi', 'noodles', 'instant', 'masala', '2 minute'],
      weight: '280g',
      barcodes: ['8901058506009'],
      rekognitionLabels: ['Noodles', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_pepsi_750ml',
      sku: 'SKU-PEP-750',
      name: 'Pepsi 750ml',
      brand: 'PepsiCo',
      category: 'snacks',
      subCategory: 'beverages',
      description: 'Pepsi cola carbonated drink 750ml',
      imageUrls: ['https://cdn.snap.dev/products/pepsi-750.jpg'],
      price: 4500,
      mrp: 5000,
      unit: '750ml',
      tags: ['pepsi', 'cola', 'soda', 'cold drink', '750ml'],
      weight: '825g',
      barcodes: ['8901023000086'],
      rekognitionLabels: ['Bottle', 'Beverage'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_coke_750ml',
      sku: 'SKU-COK-750',
      name: 'Coca Cola 750ml',
      brand: 'Coca-Cola',
      category: 'snacks',
      subCategory: 'beverages',
      description: 'Coca Cola carbonated drink 750ml',
      imageUrls: ['https://cdn.snap.dev/products/coke-750.jpg'],
      price: 4500,
      mrp: 5000,
      unit: '750ml',
      tags: ['coke', 'cola', 'coca cola', 'soda', 'cold drink'],
      weight: '825g',
      barcodes: ['8901725000092'],
      rekognitionLabels: ['Bottle', 'Beverage'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_tropicana_1l',
      sku: 'SKU-TRO-1L',
      name: 'Tropicana Orange 1L',
      brand: 'Tropicana',
      category: 'snacks',
      subCategory: 'beverages',
      description: 'Tropicana 100% orange fruit juice 1L',
      imageUrls: ['https://cdn.snap.dev/products/tropicana-1l.jpg'],
      price: 11000,
      mrp: 12000,
      unit: '1L',
      tags: ['juice', 'tropicana', 'orange', 'fruit juice', '1litre'],
      weight: '1kg',
      barcodes: ['8901058541000'],
      rekognitionLabels: ['Juice', 'Bottle'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_red_bull_250ml',
      sku: 'SKU-RDB-250',
      name: 'Red Bull 250ml',
      brand: 'Red Bull',
      category: 'snacks',
      subCategory: 'beverages',
      description: 'Red Bull energy drink 250ml',
      imageUrls: ['https://cdn.snap.dev/products/red-bull-250.jpg'],
      price: 12500,
      mrp: 13500,
      unit: '250ml',
      tags: ['energy drink', 'red bull', 'caffeine', '250ml'],
      weight: '280g',
      barcodes: ['90162902'],
      rekognitionLabels: ['Can', 'Beverage'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_bisleri_1l',
      sku: 'SKU-BIS-1L',
      name: 'Bisleri Water 1L',
      brand: 'Bisleri',
      category: 'snacks',
      subCategory: 'water',
      description: 'Bisleri packaged mineral water 1L',
      imageUrls: ['https://cdn.snap.dev/products/bisleri-1l.jpg'],
      price: 2000,
      mrp: 2500,
      unit: '1L',
      tags: ['water', 'bisleri', 'mineral water', '1litre', 'packaged water'],
      weight: '1kg',
      barcodes: ['8906069300018'],
      rekognitionLabels: ['Bottle', 'Water'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_haldirams_200',
      sku: 'SKU-HAL-200',
      name: "Haldiram's Aloo Bhujia 200g",
      brand: "Haldiram's",
      category: 'snacks',
      subCategory: 'namkeen',
      description: "Haldiram's aloo bhujia namkeen 200g",
      imageUrls: ['https://cdn.snap.dev/products/haldirams-200.jpg'],
      price: 8500,
      mrp: 9500,
      unit: '200g',
      tags: ['namkeen', 'haldirams', 'bhujia', 'snack', 'aloo', '200g'],
      weight: '200g',
      barcodes: ['8908003480013'],
      rekognitionLabels: ['Snack', 'Food'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // ── HOUSEHOLD (10 products) ────────────────────────────────────────────
    {
      productId: 'prod_surf_excel_500',
      sku: 'SKU-SFX-500',
      name: 'Surf Excel Detergent 500g',
      brand: 'Surf Excel',
      category: 'household',
      subCategory: 'laundry',
      description: 'Surf Excel washing detergent powder 500g',
      imageUrls: ['https://cdn.snap.dev/products/surf-excel-500.jpg'],
      price: 12000,
      mrp: 13500,
      unit: '500g',
      tags: ['detergent', 'surf excel', 'washing', 'clothes', '500g'],
      weight: '500g',
      barcodes: ['8901030561009'],
      rekognitionLabels: ['Detergent', 'Box'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_vim_dish_500',
      sku: 'SKU-VIM-500',
      name: 'Vim Dishwash Bar 500g',
      brand: 'Vim',
      category: 'household',
      subCategory: 'dishwash',
      description: 'Vim dishwash bar for utensils 500g',
      imageUrls: ['https://cdn.snap.dev/products/vim-dish-500.jpg'],
      price: 6500,
      mrp: 7200,
      unit: '500g',
      tags: ['dishwash', 'vim', 'utensil', 'bar', '500g', 'dish soap'],
      weight: '500g',
      barcodes: ['8901030011001'],
      rekognitionLabels: ['Soap', 'Bar'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_harpic_500',
      sku: 'SKU-HAR-500',
      name: 'Harpic Toilet Cleaner 500ml',
      brand: 'Harpic',
      category: 'household',
      subCategory: 'cleaning',
      description: 'Harpic toilet cleaner disinfectant 500ml',
      imageUrls: ['https://cdn.snap.dev/products/harpic-500.jpg'],
      price: 14500,
      mrp: 16000,
      unit: '500ml',
      tags: ['toilet cleaner', 'harpic', 'bathroom', '500ml', 'disinfectant'],
      weight: '600g',
      barcodes: ['8901514103032'],
      rekognitionLabels: ['Bottle', 'Cleaner'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_lizol_500',
      sku: 'SKU-LIZ-500',
      name: 'Lizol Floor Cleaner 500ml',
      brand: 'Lizol',
      category: 'household',
      subCategory: 'cleaning',
      description: 'Lizol floor cleaner disinfectant 500ml',
      imageUrls: ['https://cdn.snap.dev/products/lizol-500.jpg'],
      price: 17500,
      mrp: 19000,
      unit: '500ml',
      tags: ['floor cleaner', 'lizol', '500ml', 'disinfectant', 'phenyl'],
      weight: '600g',
      barcodes: ['8901514104985'],
      rekognitionLabels: ['Bottle', 'Cleaner'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_tissue_6roll',
      sku: 'SKU-TIS-6PK',
      name: 'Tempo Tissues 6 Roll Pack',
      brand: 'Tempo',
      category: 'household',
      subCategory: 'paper',
      description: 'Tempo soft toilet tissue paper 6 roll pack',
      imageUrls: ['https://cdn.snap.dev/products/tissue-6roll.jpg'],
      price: 25000,
      mrp: 27500,
      unit: '6 rolls',
      tags: ['tissue', 'toilet paper', 'tempo', '6pack', 'bathroom'],
      weight: '600g',
      barcodes: ['7310610013612'],
      rekognitionLabels: ['Tissue', 'Roll'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_kitchen_wipes',
      sku: 'SKU-SCB-2PK',
      name: 'Scotch Brite Kitchen Wipes 2 pack',
      brand: 'Scotch-Brite',
      category: 'household',
      subCategory: 'cleaning',
      description: 'Scotch-Brite kitchen cleaning wipes 2 pack',
      imageUrls: ['https://cdn.snap.dev/products/kitchen-wipes.jpg'],
      price: 8500,
      mrp: 9500,
      unit: '2 pack',
      tags: ['wipes', 'kitchen', 'scotch brite', 'cleaning', 'cloth'],
      weight: '80g',
      barcodes: ['0021200780660'],
      rekognitionLabels: ['Wipe', 'Cloth'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_ariel_1kg',
      sku: 'SKU-ARI-1KG',
      name: 'Ariel Washing Powder 1kg',
      brand: 'Ariel',
      category: 'household',
      subCategory: 'laundry',
      description: 'Ariel washing powder detergent 1kg',
      imageUrls: ['https://cdn.snap.dev/products/ariel-1kg.jpg'],
      price: 27000,
      mrp: 30000,
      unit: '1kg',
      tags: ['detergent', 'ariel', 'washing powder', '1kg', 'laundry'],
      weight: '1kg',
      barcodes: ['8001841032764'],
      rekognitionLabels: ['Detergent', 'Box'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_goodnight_mat',
      sku: 'SKU-GNK-10C',
      name: 'Good Knight Fast Card',
      brand: 'Good Knight',
      category: 'household',
      subCategory: 'pest-control',
      description: 'Good Knight fast card mosquito repellent 10 cards',
      imageUrls: ['https://cdn.snap.dev/products/goodnight-mat.jpg'],
      price: 5500,
      mrp: 6200,
      unit: '10 cards',
      tags: ['mosquito', 'repellent', 'goodnight', 'fast card', 'insect'],
      weight: '30g',
      barcodes: ['8901030874955'],
      rekognitionLabels: ['Repellent'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_colin_500',
      sku: 'SKU-COL-500',
      name: 'Colin Glass Cleaner 500ml',
      brand: 'Colin',
      category: 'household',
      subCategory: 'cleaning',
      description: 'Colin glass and surface cleaner spray 500ml',
      imageUrls: ['https://cdn.snap.dev/products/colin-500.jpg'],
      price: 19000,
      mrp: 21000,
      unit: '500ml',
      tags: ['glass cleaner', 'colin', 'window', '500ml', 'spray'],
      weight: '600g',
      barcodes: ['8901030001834'],
      rekognitionLabels: ['Bottle', 'Cleaner'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_black_flag',
      sku: 'SKU-BKF-425',
      name: 'Black Flag Cockroach Killer 425ml',
      brand: 'Black Flag',
      category: 'household',
      subCategory: 'pest-control',
      description: 'Black Flag cockroach killer insecticide spray 425ml',
      imageUrls: ['https://cdn.snap.dev/products/black-flag.jpg'],
      price: 28500,
      mrp: 32000,
      unit: '425ml',
      tags: ['insecticide', 'cockroach', 'black flag', 'spray', 'pest'],
      weight: '500g',
      barcodes: ['8901012060019'],
      rekognitionLabels: ['Can', 'Insecticide'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // ── BABY & PERSONAL CARE (5 products) ─────────────────────────────────
    {
      productId: 'prod_johnson_baby_200',
      sku: 'SKU-JNS-200',
      name: "Johnson's Baby Shampoo 200ml",
      brand: "Johnson's",
      category: 'personal-care',
      subCategory: 'baby',
      description: "Johnson's baby shampoo gentle no tears 200ml",
      imageUrls: ['https://cdn.snap.dev/products/johnson-baby-200.jpg'],
      price: 22000,
      mrp: 24000,
      unit: '200ml',
      tags: ['baby shampoo', 'johnson', '200ml', 'gentle', 'no tears'],
      weight: '220g',
      barcodes: ['8901023002301'],
      rekognitionLabels: ['Shampoo', 'Bottle'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_pampers_s3_20',
      sku: 'SKU-PAM-S3-20',
      name: 'Pampers Pants Size 3 (20 count)',
      brand: 'Pampers',
      category: 'personal-care',
      subCategory: 'baby',
      description: 'Pampers baby pants diapers size 3 20 count',
      imageUrls: ['https://cdn.snap.dev/products/pampers-s3-20.jpg'],
      price: 55000,
      mrp: 62000,
      unit: '20 count',
      tags: ['diapers', 'pampers', 'pants', 'size 3', 'baby', '20 count'],
      weight: '800g',
      barcodes: ['8700216082129'],
      rekognitionLabels: ['Diaper', 'Package'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_dove_soap_75',
      sku: 'SKU-DOV-75',
      name: 'Dove Soap 75g',
      brand: 'Dove',
      category: 'personal-care',
      subCategory: 'bath',
      description: 'Dove moisturizing beauty soap bar 75g',
      imageUrls: ['https://cdn.snap.dev/products/dove-soap-75.jpg'],
      price: 6000,
      mrp: 6800,
      unit: '75g',
      tags: ['soap', 'dove', 'moisturizing', '75g', 'bath', 'skin'],
      weight: '75g',
      barcodes: ['8712561002070'],
      rekognitionLabels: ['Soap', 'Bar'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_colgate_150',
      sku: 'SKU-COG-150',
      name: 'Colgate Strong Teeth 150g',
      brand: 'Colgate',
      category: 'personal-care',
      subCategory: 'dental',
      description: 'Colgate strong teeth toothpaste 150g',
      imageUrls: ['https://cdn.snap.dev/products/colgate-150.jpg'],
      price: 9000,
      mrp: 10000,
      unit: '150g',
      tags: ['toothpaste', 'colgate', 'strong teeth', '150g', 'dental'],
      weight: '150g',
      barcodes: ['8901314002192'],
      rekognitionLabels: ['Toothpaste', 'Tube'],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      productId: 'prod_parachute_coconut_200',
      sku: 'SKU-PAR-200',
      name: 'Parachute Coconut Oil 200ml',
      brand: 'Parachute',
      category: 'personal-care',
      subCategory: 'hair-care',
      description: 'Parachute pure coconut oil for hair 200ml',
      imageUrls: ['https://cdn.snap.dev/products/parachute-coconut-200.jpg'],
      price: 12500,
      mrp: 14000,
      unit: '200ml',
      tags: ['coconut oil', 'parachute', 'hair oil', '200ml', 'oil'],
      weight: '200g',
      barcodes: ['8901366001239'],
      rekognitionLabels: ['Bottle', 'Oil'],
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const product of products) {
    await seedItem(TABLE_NAMES.PRODUCTS, product, 'productId');
  }

  // ── Dark Stores (task 3.4) ────────────────────────────────────────────────
  const darkStores: Array<Record<string, unknown>> = [
    {
      darkStoreId: 'ds_lajpat_nagar',
      name: 'Lajpat Nagar',
      city: 'Delhi',
      lat: 28.5677,
      lng: 77.2433,
      serviceablePincodes: ['110024', '110003'],
      avgPickupMinutes: 4,
      isOperational: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      darkStoreId: 'ds_koramangala',
      name: 'Koramangala',
      city: 'Bangalore',
      lat: 12.9352,
      lng: 77.6245,
      serviceablePincodes: ['560034', '560095'],
      avgPickupMinutes: 5,
      isOperational: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      darkStoreId: 'ds_bandra',
      name: 'Bandra West',
      city: 'Mumbai',
      lat: 19.0596,
      lng: 72.8295,
      serviceablePincodes: ['400050', '400051'],
      avgPickupMinutes: 6,
      isOperational: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const darkStore of darkStores) {
    await seedItem(TABLE_NAMES.DARK_STORES, darkStore, 'darkStoreId');
  }

  // ── Inventory records (task 3.4) ──────────────────────────────────────────

  // Compact descriptor: only the fields needed for inventory + search index
  interface ProductDescriptor {
    productId: string;
    category: string;
    name: string;
    brand: string;
    tags: string[];
  }

  const productDescriptors: ProductDescriptor[] = [
    // GROCERY (15)
    { productId: 'prod_amul_milk_500', category: 'grocery', name: 'Amul Gold Milk 500ml', brand: 'Amul', tags: ['milk', 'dairy', 'amul', 'gold', '500ml'] },
    { productId: 'prod_amul_milk_1l', category: 'grocery', name: 'Amul Gold Milk 1L', brand: 'Amul', tags: ['milk', 'dairy', 'amul', 'gold', '1litre'] },
    { productId: 'prod_britannia_bread', category: 'grocery', name: 'Britannia Whole Wheat Bread', brand: 'Britannia', tags: ['bread', 'wheat', 'britannia', 'loaf', 'sandwich'] },
    { productId: 'prod_eggs_6', category: 'grocery', name: 'Eggs (6 pack)', brand: 'Farm Fresh', tags: ['eggs', 'protein', 'fresh', '6pack', 'dozen'] },
    { productId: 'prod_eggs_12', category: 'grocery', name: 'Eggs (12 pack)', brand: 'Farm Fresh', tags: ['eggs', 'protein', 'fresh', '12pack', 'dozen'] },
    { productId: 'prod_india_gate_rice_1kg', category: 'grocery', name: 'India Gate Basmati Rice 1kg', brand: 'India Gate', tags: ['rice', 'basmati', 'india gate', '1kg', 'grain'] },
    { productId: 'prod_toor_dal_500g', category: 'grocery', name: 'Tata Sampann Toor Dal 500g', brand: 'Tata Sampann', tags: ['dal', 'toor', 'lentil', 'protein', 'tata'] },
    { productId: 'prod_fortune_oil_1l', category: 'grocery', name: 'Fortune Sunflower Oil 1L', brand: 'Fortune', tags: ['oil', 'sunflower', 'fortune', 'cooking', '1litre'] },
    { productId: 'prod_amul_butter_100g', category: 'grocery', name: 'Amul Butter 100g', brand: 'Amul', tags: ['butter', 'amul', 'dairy', 'spread', '100g'] },
    { productId: 'prod_nestle_dahi_400g', category: 'grocery', name: 'Nestle Dahi 400g', brand: 'Nestle', tags: ['curd', 'dahi', 'yogurt', 'nestle', '400g'] },
    { productId: 'prod_tomatoes_500g', category: 'grocery', name: 'Fresh Tomatoes 500g', brand: 'Farm Fresh', tags: ['tomatoes', 'fresh', 'vegetable', '500g'] },
    { productId: 'prod_onions_1kg', category: 'grocery', name: 'Onions 1kg', brand: 'Farm Fresh', tags: ['onion', 'vegetable', '1kg', 'fresh'] },
    { productId: 'prod_sugar_1kg', category: 'grocery', name: 'Tata Sugar 1kg', brand: 'Tata', tags: ['sugar', 'tata', '1kg', 'white sugar'] },
    { productId: 'prod_salt_1kg', category: 'grocery', name: 'Tata Salt 1kg', brand: 'Tata', tags: ['salt', 'tata', 'iodized', '1kg'] },
    { productId: 'prod_atta_5kg', category: 'grocery', name: 'Aashirvaad Atta 5kg', brand: 'Aashirvaad', tags: ['atta', 'flour', 'wheat', 'aashirvaad', '5kg', 'chapati'] },
    // MEDICINE (10)
    { productId: 'prod_crocin_10', category: 'medicine', name: 'Crocin 500mg (10 tablets)', brand: 'GSK', tags: ['paracetamol', 'fever', 'crocin', 'pain relief', 'tablet', '500mg'] },
    { productId: 'prod_calpol_syrup', category: 'medicine', name: 'Calpol 120ml Syrup', brand: 'GSK', tags: ['paracetamol', 'fever', 'children', 'syrup', 'calpol', '120ml'] },
    { productId: 'prod_disprin_10', category: 'medicine', name: 'Disprin 10 tablets', brand: 'Reckitt', tags: ['aspirin', 'headache', 'disprin', 'pain', 'fever', 'tablet'] },
    { productId: 'prod_ors_electral', category: 'medicine', name: 'Electral ORS Powder', brand: 'Franco-Indian', tags: ['ors', 'electral', 'dehydration', 'electrolytes', 'rehydration'] },
    { productId: 'prod_vicks_50g', category: 'medicine', name: 'Vicks VapoRub 50g', brand: 'Vicks', tags: ['vicks', 'cold', 'cough', 'nasal', 'vaporub', '50g'] },
    { productId: 'prod_betadine_30ml', category: 'medicine', name: 'Betadine Antiseptic 30ml', brand: 'Win-Medicare', tags: ['antiseptic', 'betadine', 'wound', 'iodine', 'first aid'] },
    { productId: 'prod_gelusil_10', category: 'medicine', name: 'Gelusil MPS 10 tablets', brand: 'Pfizer', tags: ['antacid', 'gelusil', 'acidity', 'stomach', 'digestion'] },
    { productId: 'prod_zincovit_10', category: 'medicine', name: 'Zincovit Tablets 10 pack', brand: 'Apex', tags: ['multivitamin', 'zinc', 'vitamin', 'zincovit', 'supplement'] },
    { productId: 'prod_iodex_8g', category: 'medicine', name: 'Iodex Balm 8g', brand: 'GSK', tags: ['pain', 'muscle', 'iodex', 'balm', 'relief', 'joint'] },
    { productId: 'prod_strepsils_8', category: 'medicine', name: 'Strepsils 8 lozenges', brand: 'Reckitt', tags: ['throat', 'strepsils', 'sore throat', 'lozenges', 'honey lemon'] },
    // SNACKS & BEVERAGES (10)
    { productId: 'prod_lays_classic_26', category: 'snacks', name: "Lay's Classic Salted 26g", brand: "Lay's", tags: ['chips', 'lays', 'snack', 'potato', 'salted'] },
    { productId: 'prod_kurkure_90', category: 'snacks', name: 'Kurkure Masala Munch 90g', brand: 'Kurkure', tags: ['kurkure', 'snack', 'masala', 'corn puffs', 'namkeen'] },
    { productId: 'prod_good_day_120', category: 'snacks', name: 'Britannia Good Day Butter Cookies 120g', brand: 'Britannia', tags: ['biscuit', 'cookies', 'good day', 'britannia', 'butter'] },
    { productId: 'prod_maggi_2min', category: 'snacks', name: 'Maggi 2 Minute Noodles (4 pack)', brand: 'Maggi', tags: ['maggi', 'noodles', 'instant', 'masala', '2 minute'] },
    { productId: 'prod_pepsi_750ml', category: 'snacks', name: 'Pepsi 750ml', brand: 'PepsiCo', tags: ['pepsi', 'cola', 'soda', 'cold drink', '750ml'] },
    { productId: 'prod_coke_750ml', category: 'snacks', name: 'Coca Cola 750ml', brand: 'Coca-Cola', tags: ['coke', 'cola', 'coca cola', 'soda', 'cold drink'] },
    { productId: 'prod_tropicana_1l', category: 'snacks', name: 'Tropicana Orange 1L', brand: 'Tropicana', tags: ['juice', 'tropicana', 'orange', 'fruit juice', '1litre'] },
    { productId: 'prod_red_bull_250ml', category: 'snacks', name: 'Red Bull 250ml', brand: 'Red Bull', tags: ['energy drink', 'red bull', 'caffeine', '250ml'] },
    { productId: 'prod_bisleri_1l', category: 'snacks', name: 'Bisleri Water 1L', brand: 'Bisleri', tags: ['water', 'bisleri', 'mineral water', '1litre', 'packaged water'] },
    { productId: 'prod_haldirams_200', category: 'snacks', name: "Haldiram's Aloo Bhujia 200g", brand: "Haldiram's", tags: ['namkeen', 'haldirams', 'bhujia', 'snack', 'aloo', '200g'] },
    // HOUSEHOLD (10)
    { productId: 'prod_surf_excel_500', category: 'household', name: 'Surf Excel Detergent 500g', brand: 'Surf Excel', tags: ['detergent', 'surf excel', 'washing', 'clothes', '500g'] },
    { productId: 'prod_vim_dish_500', category: 'household', name: 'Vim Dishwash Bar 500g', brand: 'Vim', tags: ['dishwash', 'vim', 'utensil', 'bar', '500g', 'dish soap'] },
    { productId: 'prod_harpic_500', category: 'household', name: 'Harpic Toilet Cleaner 500ml', brand: 'Harpic', tags: ['toilet cleaner', 'harpic', 'bathroom', '500ml', 'disinfectant'] },
    { productId: 'prod_lizol_500', category: 'household', name: 'Lizol Floor Cleaner 500ml', brand: 'Lizol', tags: ['floor cleaner', 'lizol', '500ml', 'disinfectant', 'phenyl'] },
    { productId: 'prod_tissue_6roll', category: 'household', name: 'Tempo Tissues 6 Roll Pack', brand: 'Tempo', tags: ['tissue', 'toilet paper', 'tempo', '6pack', 'bathroom'] },
    { productId: 'prod_kitchen_wipes', category: 'household', name: 'Scotch Brite Kitchen Wipes 2 pack', brand: 'Scotch-Brite', tags: ['wipes', 'kitchen', 'scotch brite', 'cleaning', 'cloth'] },
    { productId: 'prod_ariel_1kg', category: 'household', name: 'Ariel Washing Powder 1kg', brand: 'Ariel', tags: ['detergent', 'ariel', 'washing powder', '1kg', 'laundry'] },
    { productId: 'prod_goodnight_mat', category: 'household', name: 'Good Knight Fast Card', brand: 'Good Knight', tags: ['mosquito', 'repellent', 'goodnight', 'fast card', 'insect'] },
    { productId: 'prod_colin_500', category: 'household', name: 'Colin Glass Cleaner 500ml', brand: 'Colin', tags: ['glass cleaner', 'colin', 'window', '500ml', 'spray'] },
    { productId: 'prod_black_flag', category: 'household', name: 'Black Flag Cockroach Killer 425ml', brand: 'Black Flag', tags: ['insecticide', 'cockroach', 'black flag', 'spray', 'pest'] },
    // BABY & PERSONAL CARE (5)
    { productId: 'prod_johnson_baby_200', category: 'personal-care', name: "Johnson's Baby Shampoo 200ml", brand: "Johnson's", tags: ['baby shampoo', 'johnson', '200ml', 'gentle', 'no tears'] },
    { productId: 'prod_pampers_s3_20', category: 'personal-care', name: 'Pampers Pants Size 3 (20 count)', brand: 'Pampers', tags: ['diapers', 'pampers', 'pants', 'size 3', 'baby', '20 count'] },
    { productId: 'prod_dove_soap_75', category: 'personal-care', name: 'Dove Soap 75g', brand: 'Dove', tags: ['soap', 'dove', 'moisturizing', '75g', 'bath', 'skin'] },
    { productId: 'prod_colgate_150', category: 'personal-care', name: 'Colgate Strong Teeth 150g', brand: 'Colgate', tags: ['toothpaste', 'colgate', 'strong teeth', '150g', 'dental'] },
    { productId: 'prod_parachute_coconut_200', category: 'personal-care', name: 'Parachute Coconut Oil 200ml', brand: 'Parachute', tags: ['coconut oil', 'parachute', 'hair oil', '200ml', 'oil'] },
  ];

  const OUT_OF_STOCK_IDS = new Set<string>([
    'prod_pampers_s3_20',
    'prod_ariel_1kg',
    'prod_fortune_oil_1l',
    'prod_johnson_baby_200',
    'prod_red_bull_250ml',
    'prod_bisleri_1l',
    'prod_colin_500',
    'prod_black_flag',
    'prod_parachute_coconut_200',
    'prod_goodnight_mat',
  ]);

  const DARK_STORE_BY_PINCODE: Record<string, string> = {
    '110024': 'ds_lajpat_nagar',
    '110003': 'ds_lajpat_nagar',
    '560034': 'ds_koramangala',
    '560095': 'ds_koramangala',
    '400050': 'ds_bandra',
    '400051': 'ds_bandra',
  };

  const pincodes = ['110024', '110003', '560034', '560095', '400050', '400051'];
  const nowIso = new Date().toISOString();

  for (const pincode of pincodes) {
    for (const pd of productDescriptors) {
      const isAvailableFor10Min = !OUT_OF_STOCK_IDS.has(pd.productId);
      const inventoryItem: Record<string, unknown> = {
        pincodeProductId: `${pincode}#${pd.productId}`,
        pincode,
        productId: pd.productId,
        darkStoreId: DARK_STORE_BY_PINCODE[pincode],
        stockLevel: isAvailableFor10Min ? 50 : 0,
        reservedUnits: 0,
        isAvailableFor10Min,
        updatedAt: nowIso,
      };
      await seedItem(TABLE_NAMES.INVENTORY, inventoryItem, 'pincodeProductId');
    }
  }

  // ── Search index tokens (task 3.4) ────────────────────────────────────────

  const STOPWORDS = new Set<string>([
    'the', 'a', 'an', 'of', 'for', 'in', 'with', 'and', 'or', 'to',
    'ml', 'g', 'kg', 'l', 'pack', 'per',
  ]);

  for (const pd of productDescriptors) {
    const raw = `${pd.name} ${pd.brand} ${pd.tags.join(' ')}`.toLowerCase();
    const allTokens = raw.split(/[\s,.!?-]+/);
    const uniqueTokens = [...new Set(
      allTokens.filter((t) => t.length > 0 && !STOPWORDS.has(t)),
    )];

    for (const token of uniqueTokens) {
      const tokenRow: Record<string, unknown> = {
        token,
        productId: pd.productId,
        category: pd.category,
        score: 1,
        updatedAt: nowIso,
      };
      await seedItem(TABLE_NAMES.SEARCH_INDEX, tokenRow, 'token');
    }
  }

  // ── Orders (task 3.5) ────────────────────────────────────────────────────
  // seedItem calls for TABLE_NAMES.ORDERS go here

  // ── Purchase Cadence (task 3.5) ──────────────────────────────────────────
  const cadenceProductIds: string[] = [
    'prod_amul_milk_500',
    'prod_britannia_bread',
    'prod_eggs_6',
    'prod_crocin_10',
    'prod_bisleri_1l',
    'prod_lays_classic_26',
    'prod_surf_excel_500',
    'prod_colgate_150',
    'prod_dove_soap_75',
    'prod_maggi_2min',
  ];

  const cadenceTotalPurchases: number[] = [7, 12, 5, 9, 15, 6, 10, 8, 11, 13];
  const cadenceAvgIntervalDays: number[] = [3, 4, 2, 5, 7, 3, 4, 6, 2, 5];

  const cadenceUserIds: string[] = ['test_user_regular', 'test_user_power'];
  const cadenceTtl: number = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);

  for (const userId of cadenceUserIds) {
    for (let i = 0; i < cadenceProductIds.length; i++) {
      const productId = cadenceProductIds[i];
      const totalPurchases = cadenceTotalPurchases[i];
      const avgIntervalDays = cadenceAvgIntervalDays[i];

      // Guard: all three arrays have the same fixed length (10), so this is always defined.
      // The check satisfies noUncheckedIndexedAccess without altering runtime behaviour.
      if (productId === undefined || totalPurchases === undefined || avgIntervalDays === undefined) {
        continue;
      }

      const lastPurchasedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const nextPredictedAt = new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000 + avgIntervalDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const lastPurchasedMs = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const purchaseDates: string[] = [
        new Date(lastPurchasedMs).toISOString(),
        new Date(lastPurchasedMs - avgIntervalDays * 24 * 60 * 60 * 1000).toISOString(),
        new Date(lastPurchasedMs - 2 * avgIntervalDays * 24 * 60 * 60 * 1000).toISOString(),
      ];

      const cadenceRecord: Record<string, unknown> = {
        userId,
        productId,
        totalPurchases,
        avgIntervalDays,
        lastPurchasedAt,
        nextPredictedAt,
        purchaseDates,
        ttl: cadenceTtl,
      };

      await seedItem(TABLE_NAMES.PURCHASE_CADENCE, cadenceRecord, 'userId');
    }
  }

  logSummary();
}

// ---------------------------------------------------------------------------
// Script entry point — invoked by `npm run seed:dev` (ts-node)
// ---------------------------------------------------------------------------

main().catch((err: unknown) => {
  logger.error({ message: 'Seed script failed', error: String(err) });
  process.exitCode = 1;
});
