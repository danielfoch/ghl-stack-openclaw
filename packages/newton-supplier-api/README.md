# Newton Supplier API (CLI + MCP)

SOAP client, CLI, and MCP server for Newton's Supplier API.

Public Newton docs confirm Supplier API is SOAP-based and expose two primary workflows:
- `Get` to retrieve pending referrals.
- `Ack` (or `Set` in some package variants) to acknowledge and remove referrals.

Because Newton distributes full request/response schemas via the private Supplier Package for approved suppliers, this package keeps operation names, SOAP actions, and request fields configurable.

## Install/build

```bash
npm install
npm --workspace @fub/newton-supplier-api run build
```

## Environment

Required:
- `NEWTON_SUPPLIER_ENDPOINT` (SOAP endpoint URL from Newton package)

Optional:
- `NEWTON_SUPPLIER_NAMESPACE` (default `http://tempuri.org/`)
- `NEWTON_SUPPLIER_ACTION_BASE` (if SOAPAction differs from namespace)
- `NEWTON_SUPPLIER_SOAP_ENVELOPE_NS` (default `http://schemas.xmlsoap.org/soap/envelope/`)
- `NEWTON_SUPPLIER_TIMEOUT_MS` (default `30000`)
- `NEWTON_SUPPLIER_BASIC_AUTH_USER`
- `NEWTON_SUPPLIER_BASIC_AUTH_PASSWORD`
- `NEWTON_SUPPLIER_GET_OPERATION` (default `Get`)
- `NEWTON_SUPPLIER_ACK_OPERATION` (default `Ack`)

## CLI

Run in dev:

```bash
npm --workspace @fub/newton-supplier-api run dev:cli -- get --field Username=SUPPLIER01 --field Password=secret
```

Acknowledge referral:

```bash
npm --workspace @fub/newton-supplier-api run dev:cli -- ack --field ReferralId=12345 --field Status=Accepted
```

Call any operation explicitly:

```bash
npm --workspace @fub/newton-supplier-api run dev:cli -- call \
  --operation Get \
  --field Username=SUPPLIER01 \
  --field Password=secret
```

If you need full custom XML body:

```bash
npm --workspace @fub/newton-supplier-api run dev:cli -- call \
  --operation Get \
  --raw-body-file ./request.xml
```

## MCP server

Run:

```bash
npm --workspace @fub/newton-supplier-api run dev:mcp
```

Tools exposed:
- `newton_supplier_call`
- `newton_supplier_get`
- `newton_supplier_ack`

## Notes

- Newton's public Supplier API page (version 2.0) is at [newton.ca/developers/supplier-api](https://newton.ca/developers/supplier-api/).
- Map `fields` keys to the exact element names from your Newton Supplier Package/WSDL.
- If your package uses `Set` instead of `Ack`, set `NEWTON_SUPPLIER_ACK_OPERATION=Set`.
