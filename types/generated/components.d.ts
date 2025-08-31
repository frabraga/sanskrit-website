import type { Schema, Struct } from '@strapi/strapi';

export interface SanskritDeclension extends Struct.ComponentSchema {
  collectionName: 'components_sanskrit_declensions';
  info: {
    displayName: 'declension';
    icon: 'alien';
  };
  attributes: {
    case_label: Schema.Attribute.String;
    dual: Schema.Attribute.String;
    plural: Schema.Attribute.String;
    singular: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'sanskrit.declension': SanskritDeclension;
    }
  }
}
