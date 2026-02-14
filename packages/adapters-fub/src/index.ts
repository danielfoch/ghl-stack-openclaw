import { ProviderError, type FubAdapter, type FubPerson } from "@fub/core";

type FubClientOptions = {
  baseUrl: string;
  apiKey: string;
  sourceTag: string;
};

type FubResponse<T> = {
  people?: T[];
  person?: T;
  tasks?: { id: number }[];
  id?: string | number;
};

export class FollowUpBossAdapter implements FubAdapter {
  constructor(private readonly opts: FubClientOptions) {}

  async getPersonById(id: number): Promise<FubPerson | null> {
    const res = await this.request<FubResponse<FubPerson>>(`/people/${id}`, { method: "GET" }, true);
    return res?.person ?? null;
  }

  async searchPeople(query: string): Promise<FubPerson[]> {
    const search = encodeURIComponent(query);
    const res = await this.request<FubResponse<FubPerson>>(`/people?search=${search}`);
    return res.people ?? [];
  }

  async findPersonByExternalRef(ref: { email?: string; phone?: string; name?: string }): Promise<FubPerson | null> {
    if (ref.email) {
      const people = await this.searchPeople(ref.email);
      const hit = people.find((p) => p.emails?.some((e: string) => e.toLowerCase() === ref.email?.toLowerCase()));
      if (hit) return hit;
    }

    if (ref.phone) {
      const people = await this.searchPeople(ref.phone);
      const hit = people.find((p) => p.phones?.some((phone: string) => phone === ref.phone));
      if (hit) return hit;
    }

    if (ref.name) {
      const people = await this.searchPeople(ref.name);
      return people[0] ?? null;
    }

    return null;
  }

  async upsertPerson(input: Partial<FubPerson> & { email?: string; phone?: string; name?: string }): Promise<FubPerson> {
    const existing = await this.findPersonByExternalRef({ email: input.email, phone: input.phone, name: input.name });
    if (existing) {
      await this.request(`/people/${existing.id}`, {
        method: "PUT",
        body: {
          tags: input.tags,
          stage: input.stage,
          customFields: input.customFields
        }
      });
      return { ...existing, ...input };
    }

    const created = await this.request<FubResponse<FubPerson>>(`/people`, {
      method: "POST",
      body: {
        name: input.name,
        emails: input.email ? [input.email] : undefined,
        phones: input.phone ? [input.phone] : undefined,
        tags: input.tags,
        stage: input.stage,
        customFields: input.customFields
      }
    });

    if (!created.person) throw new ProviderError("failed to create person", true);
    return created.person;
  }

  async addTag(personId: number, tag: string): Promise<void> {
    await this.request(`/people/${personId}`, {
      method: "PUT",
      body: { tags: [tag] }
    });
  }

  async removeTag(personId: number, tag: string): Promise<void> {
    await this.request(`/people/${personId}/tags/${encodeURIComponent(tag)}`, {
      method: "DELETE"
    });
  }

  async createNote(personId: number, body: string, meta?: Record<string, string>): Promise<{ id: string }> {
    const result = await this.request<FubResponse<never>>(`/notes`, {
      method: "POST",
      body: {
        personId,
        body,
        source: this.opts.sourceTag,
        metadata: meta
      }
    });

    return { id: String(result.id ?? "note") };
  }

  async createTask(personId: number, title: string, dueAt?: string, description?: string, meta?: Record<string, string>): Promise<{ id: string }> {
    const result = await this.request<FubResponse<never>>(`/tasks`, {
      method: "POST",
      body: {
        personId,
        description: description ?? title,
        dueDate: dueAt,
        title,
        source: this.opts.sourceTag,
        metadata: meta
      }
    });

    return { id: String(result.id ?? "task") };
  }

  async completeTask(taskId: number): Promise<void> {
    await this.request(`/tasks/${taskId}`, {
      method: "PUT",
      body: { completed: true }
    });
  }

  async logCall(personId: number, body: string, at: string, meta?: Record<string, string>): Promise<{ id: string }> {
    const result = await this.request<FubResponse<never>>(`/events`, {
      method: "POST",
      body: {
        type: "Call",
        personId,
        body,
        occurredAt: at,
        source: this.opts.sourceTag,
        metadata: meta
      }
    });
    return { id: String(result.id ?? `call-${Date.now()}`) };
  }

  async logEmail(personId: number, subject: string | undefined, body: string, at: string, to: string, meta?: Record<string, string>): Promise<{ id: string }> {
    const result = await this.request<FubResponse<never>>(`/events`, {
      method: "POST",
      body: {
        type: "Email",
        personId,
        body,
        subject,
        to,
        occurredAt: at,
        source: this.opts.sourceTag,
        metadata: meta
      }
    });
    return { id: String(result.id ?? `email-${Date.now()}`) };
  }

  async logText(personId: number, body: string, at: string, to: string, meta?: Record<string, string>): Promise<{ id: string }> {
    const result = await this.request<FubResponse<never>>(`/events`, {
      method: "POST",
      body: {
        type: "Text",
        personId,
        body,
        to,
        occurredAt: at,
        source: this.opts.sourceTag,
        metadata: meta
      }
    });
    return { id: String(result.id ?? `text-${Date.now()}`) };
  }

  private async request<T = unknown>(path: string, init?: { method?: string; body?: unknown }, allow404 = false): Promise<T> {
    const requestInit: RequestInit = {
      method: init?.method ?? "GET",
      headers: {
        Authorization: this.basicAuth(this.opts.apiKey),
        "Content-Type": "application/json"
      }
    };

    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);

    const response = await fetch(`${this.opts.baseUrl}${path}`, requestInit);

    if (allow404 && response.status === 404) {
      return {} as T;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new ProviderError(`FUB request failed ${response.status}: ${text}`, response.status >= 500);
    }

    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  }

  private basicAuth(apiKey: string): string {
    return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
  }
}

export class MockFubAdapter implements FubAdapter {
  private people: FubPerson[] = [
    { id: 1, name: "John Smith", emails: ["john@example.com"], phones: ["+14165550001"], tags: ["Lead"] },
    { id: 2, name: "Sarah Lee", emails: ["sarah@example.com"], phones: ["+14165550002"], tags: [] }
  ];

  private nextId = 100;

  async getPersonById(id: number): Promise<FubPerson | null> {
    return this.people.find((p: FubPerson) => p.id === id) ?? null;
  }

  async searchPeople(query: string): Promise<FubPerson[]> {
    const q = query.toLowerCase();
    return this.people.filter((p: FubPerson) =>
      [p.name, ...(p.emails ?? []), ...(p.phones ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }

  async findPersonByExternalRef(ref: { email?: string; phone?: string; name?: string }): Promise<FubPerson | null> {
    return this.people.find((p: FubPerson) =>
      Boolean(
        (ref.email && p.emails?.includes(ref.email)) ||
        (ref.phone && p.phones?.includes(ref.phone)) ||
        (ref.name && p.name?.toLowerCase() === ref.name.toLowerCase())
      )
    ) ?? null;
  }

  async upsertPerson(input: Partial<FubPerson> & { email?: string; phone?: string; name?: string }): Promise<FubPerson> {
    const existing = await this.findPersonByExternalRef({ email: input.email, phone: input.phone, name: input.name });
    if (existing) {
      Object.assign(existing, input);
      return existing;
    }

    const created: FubPerson = {
      id: this.nextId++,
      name: input.name,
      emails: input.email ? [input.email] : [],
      phones: input.phone ? [input.phone] : [],
      tags: input.tags ?? [],
      stage: input.stage,
      customFields: input.customFields
    };
    this.people.push(created);
    return created;
  }

  async addTag(personId: number, tag: string): Promise<void> {
    const p = this.people.find((x: FubPerson) => x.id === personId);
    if (!p) return;
    p.tags = Array.from(new Set([...(p.tags ?? []), tag]));
  }

  async removeTag(personId: number, tag: string): Promise<void> {
    const p = this.people.find((x: FubPerson) => x.id === personId);
    if (!p) return;
    p.tags = (p.tags ?? []).filter((x: string) => x !== tag);
  }

  async createNote(_personId: number, _body: string, _meta?: Record<string, string>): Promise<{ id: string }> {
    return { id: `note-${Date.now()}` };
  }

  async createTask(_personId: number, _title: string, _dueAt?: string, _description?: string, _meta?: Record<string, string>): Promise<{ id: string }> {
    return { id: `task-${Date.now()}` };
  }

  async completeTask(_taskId: number): Promise<void> {
    return;
  }

  async logCall(_personId: number, _body: string, _at: string, _meta?: Record<string, string>): Promise<{ id: string }> {
    return { id: `call-${Date.now()}` };
  }

  async logEmail(_personId: number, _subject: string | undefined, _body: string, _at: string, _to: string, _meta?: Record<string, string>): Promise<{ id: string }> {
    return { id: `email-${Date.now()}` };
  }

  async logText(_personId: number, _body: string, _at: string, _to: string, _meta?: Record<string, string>): Promise<{ id: string }> {
    return { id: `text-${Date.now()}` };
  }
}
