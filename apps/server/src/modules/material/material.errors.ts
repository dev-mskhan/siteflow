export class MaterialNotFoundError extends Error {
  statusCode = 404;
  code = 'MATERIAL_NOT_FOUND';
  constructor(id: string) {
    super(`Material not found: ${id}`);
  }
}

export class MaterialDuplicateCodeError extends Error {
  statusCode = 409;
  code = 'MATERIAL_DUPLICATE_CODE';
  constructor(code: string) {
    super(`Material code already exists: ${code}`);
  }
}

export class MaterialInactiveError extends Error {
  statusCode = 422;
  code = 'MATERIAL_INACTIVE';
  constructor(id: string) {
    super(`Material ${id} is INACTIVE and cannot be used in procurement documents`);
  }
}
