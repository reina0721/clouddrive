import { z } from 'zod';

export const propertyKinds = [
  'text',
  'number',
  'checkbox',
  'select',
  'multi-select',
  'link',
  'rating',
] as const;
export const propertyDefinitionLimit = 32;
export const propertyRatingLimit = 20;
export const defaultPropertyRating = 5;
export const propertyKeyPattern = /^[A-Za-z0-9_-]{1,64}$/;
const decimalValue = /^-?[0-9]+(?:\.[0-9]+)?$/;

export const propertyDefinitionSchema = z.object({
  key: z.string().regex(propertyKeyPattern),
  name: z
    .string()
    .min(1)
    .refine((value) => [...value].length <= 64),
  kind: z.enum(propertyKinds),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  options: z.array(z.string()).max(16).optional(),
  defaultValue: z.string().optional(),
});

const propertyDefinitionSetSchema = z.object({
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  items: z.array(propertyDefinitionSchema).max(propertyDefinitionLimit),
});

export const propertyDefinitionsViewSchema = propertyDefinitionSetSchema.extend({
  canSave: z.boolean(),
});
export type PropertyDefinition = z.infer<typeof propertyDefinitionSchema>;
export type PropertyDefinitionSet = z.infer<typeof propertyDefinitionSetSchema>;
export type PropertyDefinitionsView = z.infer<typeof propertyDefinitionsViewSchema>;
export type PropertyKind = (typeof propertyKinds)[number];

export function parsePropertyChoices(value: string): string[] | undefined {
  try {
    const choices: unknown = JSON.parse(value);
    return z.array(z.string()).safeParse(choices).data;
  } catch {
    return undefined;
  }
}

export function validateManagedProperty(definition: PropertyDefinition, value: string): boolean {
  if ([...value].length > 256) return false;
  const withinBounds = (number: number) =>
    number >= (definition.minimum ?? -Infinity) && number <= (definition.maximum ?? Infinity);
  switch (definition.kind) {
    case 'text':
      return withinBounds([...value].length);
    case 'number':
      return (
        decimalValue.test(value) && Number.isFinite(Number(value)) && withinBounds(Number(value))
      );
    case 'checkbox':
      return value === 'true' || value === 'false';
    case 'select':
      return definition.options?.includes(value) ?? false;
    case 'multi-select': {
      const choices = parsePropertyChoices(value);
      return (
        choices !== undefined &&
        new Set(choices).size === choices.length &&
        choices.every((choice) => definition.options?.includes(choice))
      );
    }
    case 'link':
      try {
        if (!/^https?:\/\/[^/]/.test(value) || /\s/.test(value)) return false;
        const url = new URL(value);
        return !!url.hostname && !url.username && !url.password;
      } catch {
        return false;
      }
    case 'rating':
      return (
        /^[1-9][0-9]*$/.test(value) &&
        Number(value) <= (definition.maximum ?? defaultPropertyRating)
      );
  }
}

export function initialManagedPropertyValue(
  definition: Pick<PropertyDefinition, 'kind' | 'defaultValue'>,
): string {
  if (definition.defaultValue !== undefined) return definition.defaultValue;
  if (definition.kind === 'checkbox') return 'false';
  if (definition.kind === 'multi-select') return '[]';
  return '';
}
