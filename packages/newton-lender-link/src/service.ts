import { NewtonLinkClient, JsonObject } from "./client.js";
import { NewtonLinkConfig } from "./config.js";

export class NewtonLinkService {
  readonly client: NewtonLinkClient;

  constructor(readonly cfg: NewtonLinkConfig) {
    this.client = new NewtonLinkClient(cfg);
  }

  async authInfo(forceRefresh = false) {
    const token = await this.client.getToken(forceRefresh);
    return {
      tokenType: "bearer",
      expiresAt: new Date(token.expiresAtMs).toISOString()
    };
  }

  async lenderDetails(input?: { unitId?: string; posSystemId?: string }) {
    return this.client.get("/v1/lender-details", {
      unitId: input?.unitId ?? this.cfg.NEWTON_LINK_UNIT_ID,
      posSystemId: input?.posSystemId ?? this.cfg.NEWTON_LINK_POS_SYSTEM_ID
    });
  }

  async submitApplication(payload: JsonObject) {
    return this.client.post("/v1/applications", this.withAuthFields(payload));
  }

  async validateApplication(payload: JsonObject) {
    return this.client.post(
      "/v1/validations/applications",
      this.withAuthFields(payload)
    );
  }

  async submitDocument(payload: JsonObject) {
    return this.client.post("/v1/application/documents", this.withAuthFields(payload));
  }

  async pendingApplications(input?: { unitId?: string; posSystemId?: string }) {
    return this.client.get("/v1/pending-applications", {
      unitId: input?.unitId ?? this.cfg.NEWTON_LINK_UNIT_ID,
      posSystemId: input?.posSystemId ?? this.cfg.NEWTON_LINK_POS_SYSTEM_ID
    });
  }

  async searchApplicationDecisions(payload: JsonObject) {
    return this.client.post(
      "/v1/application-decisions/search",
      this.withAuthFields(payload)
    );
  }

  async acknowledgeApplicationDecision(payload: JsonObject) {
    return this.client.post(
      "/v1/application-decisions/acknowledgement",
      this.withAuthFields(payload)
    );
  }

  async updateApplicationStatus(payload: JsonObject) {
    return this.client.post(
      "/v1/application/updatestatus",
      this.withAuthFields(payload)
    );
  }

  async updateComplianceStatus(payload: JsonObject) {
    return this.client.post(
      "/v1/application/updatecompliancestatus",
      this.withAuthFields(payload)
    );
  }

  async creditBureauEquifax(payload: JsonObject) {
    return this.client.post(
      "/v1/credit-bureau/equifax",
      this.withAuthFields(payload)
    );
  }

  async creditBureauTransunion(payload: JsonObject) {
    return this.client.post(
      "/v1/credit-bureau/transunion",
      this.withAuthFields(payload)
    );
  }

  async submitLifeInsurance(payload: JsonObject) {
    return this.client.post("/v1/life-insurance", this.withAuthFields(payload));
  }

  async lifeInsuranceStatus(payload: JsonObject) {
    return this.client.post(
      "/v1/life-insurance-status",
      this.withAuthFields(payload)
    );
  }

  async acknowledgeLifeInsuranceStatus(payload: JsonObject) {
    return this.client.post(
      "/v1/life-insurance-status/acknowledgement",
      this.withAuthFields(payload)
    );
  }

  async propertyValuation(payload: JsonObject) {
    return this.client.post("/v1/valuations", this.withAuthFields(payload));
  }

  private withAuthFields(payload: JsonObject): JsonObject {
    return {
      ...payload,
      unitId: this.ensureString(payload.unitId, this.cfg.NEWTON_LINK_UNIT_ID),
      posSystem: this.ensureString(payload.posSystem, this.cfg.NEWTON_LINK_POS_SYSTEM_ID)
    };
  }

  private ensureString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  }
}
