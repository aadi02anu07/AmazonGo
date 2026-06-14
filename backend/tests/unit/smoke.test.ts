import { AppError, ErrorCodes } from '../../src/constants/errors';
import { response } from '../../src/utils/response';
import { buildProduct, buildUser, buildOrder } from '../fixtures';

describe('Smoke Tests — Foundation Setup', () => {
  it('AppError can be thrown and caught with correct properties', () => {
    const err = new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found', 404);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('PRODUCT_NOT_FOUND');
    expect(err.message).toBe('Product not found');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('AppError');
  });

  it('response.success returns correct envelope', () => {
    const result = response.success({ foo: 'bar' }) as { statusCode: number; body: string };
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ foo: 'bar' });
    expect(body.error).toBeNull();
    expect(body.requestId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('response.error returns correct envelope', () => {
    const result = response.error('PRODUCT_NOT_FOUND', 'Not found', 404, false) as { statusCode: number; body: string };
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(body.error.message).toBe('Not found');
  });

  it('buildProduct fixture returns valid Product', () => {
    const product = buildProduct();
    expect(product.productId).toBe('prod_test_001');
    expect(product.price).toBe(5000);
    expect(product.isAvailable).toBe(true);
  });

  it('buildProduct fixture accepts overrides', () => {
    const product = buildProduct({ productId: 'custom_id', price: 9999 });
    expect(product.productId).toBe('custom_id');
    expect(product.price).toBe(9999);
  });

  it('buildUser fixture returns valid user', () => {
    const user = buildUser();
    expect(user['userId']).toBe('test_user_001');
    expect(user['totalOrders']).toBe(0);
  });

  it('buildOrder fixture returns valid order', () => {
    const order = buildOrder();
    expect(order['orderId']).toMatch(/^ord_/);
    expect(order['status']).toBe('PLACED');
  });

  it('All required ErrorCodes are defined', () => {
    expect(ErrorCodes.PRODUCT_NOT_FOUND).toBe('PRODUCT_NOT_FOUND');
    expect(ErrorCodes.BARCODE_NOT_FOUND).toBe('BARCODE_NOT_FOUND');
    expect(ErrorCodes.EMPTY_TRANSCRIPT).toBe('EMPTY_TRANSCRIPT');
    expect(ErrorCodes.RESERVATION_FAILED).toBe('RESERVATION_FAILED');
    expect(ErrorCodes.PINCODE_NOT_SERVICEABLE).toBe('PINCODE_NOT_SERVICEABLE');
    expect(ErrorCodes.DARKSTORE_OFFLINE).toBe('DARKSTORE_OFFLINE');
    expect(ErrorCodes.OUT_OF_STOCK).toBe('OUT_OF_STOCK');
    expect(ErrorCodes.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
    expect(ErrorCodes.ORDER_NOT_FOUND).toBe('ORDER_NOT_FOUND');
  });
});
