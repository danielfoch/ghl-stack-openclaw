export type XmlPrimitive = string | number | boolean;

export type SupplierFieldValue =
  | XmlPrimitive
  | null
  | undefined
  | SupplierFieldValue[]
  | { [key: string]: SupplierFieldValue };

export type SupplierFields = Record<string, SupplierFieldValue>;

export type SoapCallInput = {
  operation: string;
  fields?: SupplierFields;
  rawBodyXml?: string;
  soapAction?: string;
};

export type SoapCallResult = {
  request: {
    operation: string;
    soapAction: string;
    endpoint: string;
    fields?: SupplierFields;
    rawBodyXml?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    bodyXml: string;
    parsed: unknown;
  };
};

export type KnownOperationName = "get" | "ack";
