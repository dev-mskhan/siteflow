export class SupplierNotFoundError extends Error {
  statusCode = 404;
  code = 'SUPPLIER_NOT_FOUND';
  constructor(id: string) {
    super(`Supplier not found: ${id}`);
  }
}

export class SupplierDuplicateCodeError extends Error {
  statusCode = 409;
  code = 'SUPPLIER_DUPLICATE_CODE';
  constructor(code: string) {
    super(`Supplier code already exists: ${code}`);
  }
}

export class SupplierInactiveError extends Error {
  statusCode = 422;
  code = 'SUPPLIER_INACTIVE';
  constructor(id: string) {
    super(`Supplier ${id} is INACTIVE or SUSPENDED`);
  }
}

export class SupplierContactNotFoundError extends Error {
  statusCode = 404;
  code = 'SUPPLIER_CONTACT_NOT_FOUND';
  constructor(id: string) {
    super(`Supplier contact not found: ${id}`);
  }
}

export class PrimarySupplierContactAlreadyExistsError extends Error {
  statusCode = 409;
  code = 'PRIMARY_SUPPLIER_CONTACT_ALREADY_EXISTS';
  constructor(supplierId: string) {
    super(`Supplier ${supplierId} already has a primary contact`);
  }
}
