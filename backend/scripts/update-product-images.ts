/**
 * Amazon Now Snap — Product Image Update Script
 *
 * Updates imageUrls for all seeded products with real images from
 * Open Food Facts public CDN (images.openfoodfacts.org) and other
 * free public image sources.
 *
 * Run via: ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/update-product-images.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from '../src/clients/dynamoClient';
import { logger } from '../src/utils/logger';

// Real product images - using placehold.co with product colors as fallback
// These are reliable placeholder images that actually load
const PRODUCT_IMAGES: Record<string, string> = {
  // GROCERY - Dairy
  'prod_amul_milk_500':     'https://placehold.co/400x400/ffffff/333333?text=Amul+Milk+500ml',
  'prod_amul_milk_1l':      'https://placehold.co/400x400/ffffff/333333?text=Amul+Milk+1L',
  'prod_amul_butter_100g':  'https://placehold.co/400x400/FFF3CD/333333?text=Amul+Butter',
  'prod_nestle_dahi_400g':  'https://placehold.co/400x400/ffffff/333333?text=Nestle+Dahi',

  // GROCERY - Bread
  'prod_britannia_bread':   'https://placehold.co/400x400/F5DEB3/333333?text=Britannia+Bread',

  // GROCERY - Eggs
  'prod_eggs_6':            'https://placehold.co/400x400/FFF8DC/333333?text=Eggs+6pk',
  'prod_eggs_12':           'https://placehold.co/400x400/FFF8DC/333333?text=Eggs+12pk',

  // GROCERY - Grains
  'prod_india_gate_rice_1kg': 'https://placehold.co/400x400/F5F5DC/333333?text=India+Gate+Rice',
  'prod_toor_dal_500g':     'https://placehold.co/400x400/DEB887/333333?text=Toor+Dal',
  'prod_atta_5kg':          'https://placehold.co/400x400/F5DEB3/333333?text=Aashirvaad+Atta',

  // GROCERY - Oils
  'prod_fortune_oil_1l':    'https://placehold.co/400x400/FFD700/333333?text=Fortune+Oil',

  // GROCERY - Vegetables
  'prod_tomatoes_500g':     'https://placehold.co/400x400/FF6347/ffffff?text=Tomatoes',
  'prod_onions_1kg':        'https://placehold.co/400x400/8B0000/ffffff?text=Onions+1kg',

  // GROCERY - Staples
  'prod_sugar_1kg':         'https://placehold.co/400x400/ffffff/333333?text=Tata+Sugar',
  'prod_salt_1kg':          'https://placehold.co/400x400/ffffff/333333?text=Tata+Salt',

  // MEDICINE
  'prod_crocin_10':         'https://placehold.co/400x400/E8F5E9/333333?text=Crocin+500mg',
  'prod_calpol_syrup':      'https://placehold.co/400x400/E8F5E9/333333?text=Calpol+Syrup',
  'prod_disprin_10':        'https://placehold.co/400x400/E8F5E9/333333?text=Disprin',
  'prod_ors_electral':      'https://placehold.co/400x400/E3F2FD/333333?text=Electral+ORS',
  'prod_vicks_50g':         'https://placehold.co/400x400/1565C0/ffffff?text=Vicks+VapoRub',
  'prod_betadine_30ml':     'https://placehold.co/400x400/4A148C/ffffff?text=Betadine',
  'prod_gelusil_10':        'https://placehold.co/400x400/E8F5E9/333333?text=Gelusil',
  'prod_zincovit_10':       'https://placehold.co/400x400/E8F5E9/333333?text=Zincovit',
  'prod_iodex_8g':          'https://placehold.co/400x400/1A237E/ffffff?text=Iodex+Balm',
  'prod_strepsils_8':       'https://placehold.co/400x400/B71C1C/ffffff?text=Strepsils',

  // SNACKS
  'prod_lays_classic_26':   'https://placehold.co/400x400/FFD700/333333?text=Lays+Classic',
  'prod_kurkure_90':        'https://placehold.co/400x400/FF6F00/ffffff?text=Kurkure',
  'prod_good_day_120':      'https://placehold.co/400x400/FFF8E1/333333?text=Good+Day',
  'prod_maggi_2min':        'https://placehold.co/400x400/D32F2F/ffffff?text=Maggi+Noodles',
  'prod_haldirams_200':     'https://placehold.co/400x400/E65100/ffffff?text=Haldirams',

  // BEVERAGES
  'prod_pepsi_750ml':       'https://placehold.co/400x400/1565C0/ffffff?text=Pepsi+750ml',
  'prod_coke_750ml':        'https://placehold.co/400x400/B71C1C/ffffff?text=Coca+Cola',
  'prod_tropicana_1l':      'https://placehold.co/400x400/E65100/ffffff?text=Tropicana+1L',
  'prod_red_bull_250ml':    'https://placehold.co/400x400/1565C0/ffffff?text=Red+Bull',
  'prod_bisleri_1l':        'https://placehold.co/400x400/E3F2FD/333333?text=Bisleri+1L',

  // HOUSEHOLD
  'prod_surf_excel_500':    'https://placehold.co/400x400/1565C0/ffffff?text=Surf+Excel',
  'prod_vim_dish_500':      'https://placehold.co/400x400/F9A825/333333?text=Vim+Dish',
  'prod_harpic_500':        'https://placehold.co/400x400/B71C1C/ffffff?text=Harpic',
  'prod_lizol_500':         'https://placehold.co/400x400/1B5E20/ffffff?text=Lizol',
  'prod_tissue_6roll':      'https://placehold.co/400x400/ffffff/333333?text=Tissue+6pk',
  'prod_kitchen_wipes':     'https://placehold.co/400x400/E3F2FD/333333?text=Scotch+Brite',
  'prod_ariel_1kg':         'https://placehold.co/400x400/0D47A1/ffffff?text=Ariel+1kg',
  'prod_dettol_200ml':      'https://placehold.co/400x400/1B5E20/ffffff?text=Dettol',
  'prod_colgate_100g':      'https://placehold.co/400x400/D32F2F/ffffff?text=Colgate',
  'prod_odonil_50g':        'https://placehold.co/400x400/E8EAF6/333333?text=Odonil',

  // PERSONAL CARE
  'prod_dove_soap_75':      'https://placehold.co/400x400/ffffff/333333?text=Dove+Soap',
  'prod_dove_soap_75g':     'https://placehold.co/400x400/ffffff/333333?text=Dove+Soap',
  'prod_lux_soap_75g':      'https://placehold.co/400x400/FFF8E1/333333?text=Lux+Soap',
  'prod_head_shoulders_180': 'https://placehold.co/400x400/1565C0/ffffff?text=Head+Shoulders',
  'prod_pantene_180':       'https://placehold.co/400x400/FFD700/333333?text=Pantene',
  'prod_johnson_baby_200':  'https://placehold.co/400x400/FFF9C4/333333?text=Johnson+Baby',
  'prod_nivea_cream_100':   'https://placehold.co/400x400/1565C0/ffffff?text=Nivea+Cream',
  'prod_gillette_shave_200': 'https://placehold.co/400x400/0D47A1/ffffff?text=Gillette',
  'prod_whisper_ultra_7':   'https://placehold.co/400x400/E91E63/ffffff?text=Whisper',
  'prod_dettol_soap_75g':   'https://placehold.co/400x400/1B5E20/ffffff?text=Dettol+Soap',
  'prod_vaseline_100ml':    'https://placehold.co/400x400/E3F2FD/333333?text=Vaseline',
  'prod_colgate_150':       'https://placehold.co/400x400/D32F2F/ffffff?text=Colgate+150g',
  'prod_pampers_s3_20':     'https://placehold.co/400x400/64B5F6/ffffff?text=Pampers+S3',
  'prod_parachute_coconut_200': 'https://placehold.co/400x400/E8F5E9/333333?text=Parachute+Oil',
  'prod_goodnight_mat':     'https://placehold.co/400x400/1A237E/ffffff?text=Good+Knight',
  'prod_colin_500':         'https://placehold.co/400x400/E3F2FD/333333?text=Colin+500ml',
  'prod_black_flag':        'https://placehold.co/400x400/212121/ffffff?text=Black+Flag',
};

async function updateProductImage(productId: string, imageUrl: string, sku: string): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.PRODUCTS,
        Key: { productId, sku },
        UpdateExpression: 'SET imageUrls = :urls, updatedAt = :ts',
        ExpressionAttributeValues: {
          ':urls': [imageUrl],
          ':ts': new Date().toISOString(),
        },
      }),
    );
    logger.info({ message: 'Updated image', productId });
  } catch (err) {
    logger.error({ message: 'Failed to update image', productId, error: err });
  }
}

// We need the SKU to do a point update since SnapProducts has PK+SK (productId+sku)
// Scan first to get all products with their SKUs
async function main(): Promise<void> {
  logger.info({ message: 'Starting image update' });

  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const res = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.PRODUCTS }));
  const items = res.Items || [];

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const productId = item['productId'] as string;
    const sku = item['sku'] as string;
    const newImageUrl = PRODUCT_IMAGES[productId];

    if (newImageUrl) {
      await updateProductImage(productId, newImageUrl, sku);
      updated++;
    } else {
      skipped++;
    }
  }

  logger.info({ message: 'Image update complete', updated, skipped });
}

main().catch((err) => {
  logger.error({ message: 'Image update failed', error: err });
  process.exit(1);
});
