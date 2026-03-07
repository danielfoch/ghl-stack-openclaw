import { AppConfig } from "./config.js";
import { NewtonSupplierClient } from "./client.js";
import { SoapCallResult, SupplierFields } from "./types.js";

export class NewtonSupplierService {
  readonly client: NewtonSupplierClient;

  constructor(readonly cfg: AppConfig) {
    this.client = new NewtonSupplierClient(cfg);
  }

  async callOperation(input: {
    operation: string;
    fields?: SupplierFields;
    rawBodyXml?: string;
    soapAction?: string;
  }): Promise<SoapCallResult> {
    return this.client.call(input);
  }

  async getReferrals(fields?: SupplierFields): Promise<SoapCallResult> {
    return this.client.call({
      operation: this.cfg.NEWTON_SUPPLIER_GET_OPERATION,
      fields
    });
  }

  async acknowledgeReferral(fields?: SupplierFields): Promise<SoapCallResult> {
    return this.client.call({
      operation: this.cfg.NEWTON_SUPPLIER_ACK_OPERATION,
      fields
    });
  }
}
