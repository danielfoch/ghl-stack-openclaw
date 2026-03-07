import { AppConfig } from "./config.js";
import { SoapCallInput, SoapCallResult } from "./types.js";
import { fieldsToXml, findNodeByLocalName, parseXml } from "./xml.js";

export class NewtonSupplierClient {
  constructor(private readonly cfg: AppConfig) {}

  async call(input: SoapCallInput): Promise<SoapCallResult> {
    const soapAction =
      input.soapAction ??
      this.resolveSoapAction(input.operation, this.cfg.NEWTON_SUPPLIER_NAMESPACE);

    const bodyContent =
      input.rawBodyXml ??
      `<${input.operation} xmlns="${this.cfg.NEWTON_SUPPLIER_NAMESPACE}">${fieldsToXml(
        input.fields ?? {}
      )}</${input.operation}>`;

    const envelope = this.wrapEnvelope(bodyContent);

    const headers: HeadersInit = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction
    };

    if (this.cfg.NEWTON_SUPPLIER_BASIC_AUTH_USER) {
      const token = Buffer.from(
        `${this.cfg.NEWTON_SUPPLIER_BASIC_AUTH_USER}:${this.cfg.NEWTON_SUPPLIER_BASIC_AUTH_PASSWORD}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${token}`;
    }

    const response = await fetch(this.cfg.NEWTON_SUPPLIER_ENDPOINT, {
      method: "POST",
      headers,
      body: envelope,
      signal: AbortSignal.timeout(this.cfg.NEWTON_SUPPLIER_TIMEOUT_MS)
    });

    const bodyXml = await response.text();
    const parsed = parseXml(bodyXml);

    const fault = findNodeByLocalName(parsed, "Fault");
    if (fault) {
      throw new Error(`SOAP Fault: ${JSON.stringify(fault)}`);
    }

    const out: SoapCallResult = {
      request: {
        operation: input.operation,
        soapAction,
        endpoint: this.cfg.NEWTON_SUPPLIER_ENDPOINT,
        fields: input.fields,
        rawBodyXml: input.rawBodyXml
      },
      response: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        bodyXml,
        parsed
      }
    };

    if (!response.ok) {
      throw new Error(
        `Supplier API HTTP ${response.status}: ${JSON.stringify(out.response.parsed)}`
      );
    }

    return out;
  }

  private wrapEnvelope(body: string): string {
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="${this.cfg.NEWTON_SUPPLIER_SOAP_ENVELOPE_NS}">`,
      "<soap:Body>",
      body,
      "</soap:Body>",
      "</soap:Envelope>"
    ].join("");
  }

  private resolveSoapAction(operation: string, namespace: string): string {
    if (this.cfg.NEWTON_SUPPLIER_ACTION_BASE) {
      return `${this.cfg.NEWTON_SUPPLIER_ACTION_BASE.replace(/\/$/, "")}/${operation}`;
    }
    return `${namespace.replace(/\/$/, "")}/${operation}`;
  }
}
