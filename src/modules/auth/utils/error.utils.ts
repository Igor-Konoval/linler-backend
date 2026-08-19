import { type ValidationError } from '@nestjs/common';

type FieldErrors = Record<string, string[]>;

export function getFieldErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldErrors {
  return errors.reduce<FieldErrors>((result, error) => {
    const fieldPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      result[fieldPath] = Object.values(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(result, getFieldErrors(error.children, fieldPath));
    }

    return result;
  }, {});
}
