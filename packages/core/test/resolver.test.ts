import { describe, expect, it } from "vitest";
import { AppStore } from "../src/db/store.js";
import { resolveOrUpsertPerson, resolvePerson } from "../src/actions/resolver.js";
import type { FubAdapter, FubPerson } from "../src/types/adapters.js";

class LocalMockFubAdapter implements FubAdapter {
  private people: FubPerson[] = [{ id: 1, name: "John Smith", emails: ["john@example.com"], phones: ["+14165550001"], tags: [] }];
  private nextId = 10;

  async getPersonById(id: number): Promise<FubPerson | null> { return this.people.find((p) => p.id === id) ?? null; }
  async searchPeople(query: string): Promise<FubPerson[]> { return this.people.filter((p) => p.name?.toLowerCase().includes(query.toLowerCase())); }
  async findPersonByExternalRef(ref: { email?: string; phone?: string; name?: string }): Promise<FubPerson | null> {
    return this.people.find((p) => (ref.email && p.emails?.includes(ref.email)) || (ref.phone && p.phones?.includes(ref.phone)) || (ref.name && p.name === ref.name)) ?? null;
  }
  async upsertPerson(input: Partial<FubPerson> & { email?: string; phone?: string; name?: string }): Promise<FubPerson> {
    const created: FubPerson = { id: this.nextId++, name: input.name, emails: input.email ? [input.email] : [], phones: input.phone ? [input.phone] : [] };
    this.people.push(created);
    return created;
  }
  async addTag(): Promise<void> { return; }
  async removeTag(): Promise<void> { return; }
  async createNote(): Promise<{ id: string }> { return { id: "note" }; }
  async createTask(): Promise<{ id: string }> { return { id: "task" }; }
  async completeTask(): Promise<void> { return; }
  async logCall(): Promise<{ id: string }> { return { id: "call" }; }
  async logEmail(): Promise<{ id: string }> { return { id: "email" }; }
  async logText(): Promise<{ id: string }> { return { id: "text" }; }
}

describe("resolver", () => {
  it("finds existing person by email", async () => {
    const fub = new LocalMockFubAdapter();
    const store = new AppStore(":memory:");
    const person = await resolvePerson({ email: "john@example.com" }, fub, store);
    expect(person?.id).toBe(1);
  });

  it("upserts new person once and dedupes", async () => {
    const fub = new LocalMockFubAdapter();
    const store = new AppStore(":memory:");
    const first = await resolveOrUpsertPerson({ email: "new@example.com", name: "New Person" }, fub, store);
    const second = await resolveOrUpsertPerson({ email: "new@example.com", name: "New Person" }, fub, store);
    expect(first.id).toBe(second.id);
  });
});
