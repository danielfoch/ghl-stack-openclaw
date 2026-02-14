export type FubPerson = {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  emails?: string[];
  phones?: string[];
  tags?: string[];
  stage?: string;
  customFields?: Record<string, string | number | boolean>;
};

export type Listing = {
  id: string;
  mlsId?: string;
  address: string;
  city?: string;
  status?: string;
  price?: number;
  dom?: number;
  lastUpdated?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  raw?: Record<string, unknown>;
};

export type OutboundMessage = {
  to: string;
  body: string;
  subject?: string;
  from?: string;
};

export type OutboundResult = {
  providerMessageId: string;
  provider: string;
  sentAt: string;
  to: string;
};

export interface FubAdapter {
  searchPeople(query: string): Promise<FubPerson[]>;
  findPersonByExternalRef(ref: { email?: string; phone?: string; name?: string }): Promise<FubPerson | null>;
  upsertPerson(input: Partial<FubPerson> & { email?: string; phone?: string; name?: string }): Promise<FubPerson>;
  addTag(personId: number, tag: string): Promise<void>;
  removeTag(personId: number, tag: string): Promise<void>;
  createNote(personId: number, body: string, meta?: Record<string, string>): Promise<{ id: string }>;
  createTask(personId: number, title: string, dueAt?: string, description?: string, meta?: Record<string, string>): Promise<{ id: string }>;
  completeTask(taskId: number): Promise<void>;
  logCall(personId: number, body: string, at: string, meta?: Record<string, string>): Promise<{ id: string }>;
  logEmail(personId: number, subject: string | undefined, body: string, at: string, to: string, meta?: Record<string, string>): Promise<{ id: string }>;
  logText(personId: number, body: string, at: string, to: string, meta?: Record<string, string>): Promise<{ id: string }>;
}

export interface IdxAdapter {
  searchListings(query: Record<string, string | number | boolean>): Promise<Listing[]>;
  getListingByMlsId(id: string): Promise<Listing | null>;
  getListingByAddress(address: string): Promise<Listing | null>;
  getAgentListings(agentId: string): Promise<Listing[]>;
  enrichContactContext(personId: number): Promise<Record<string, unknown>>;
}

export interface SmsAdapter {
  sendSMS(message: OutboundMessage): Promise<OutboundResult>;
}

export interface EmailAdapter {
  sendEmail(message: OutboundMessage): Promise<OutboundResult>;
}

export interface VoiceAdapter {
  sendVoiceMessage(message: OutboundMessage): Promise<OutboundResult>;
}

export interface OutboundOnlyTransport {
  send(channel: "imessage" | "whatsapp", message: OutboundMessage): Promise<OutboundResult>;
}
