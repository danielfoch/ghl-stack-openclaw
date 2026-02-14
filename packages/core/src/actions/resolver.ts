import type { FubAdapter, FubPerson } from "../types/adapters.js";
import type { AppStore } from "../db/store.js";

export type PersonRef = {
  personId?: number;
  email?: string;
  phone?: string;
  name?: string;
};

function keyOf(ref: PersonRef): string | null {
  if (ref.personId) return `person:${ref.personId}`;
  if (ref.email) return `email:${ref.email.toLowerCase()}`;
  if (ref.phone) return `phone:${ref.phone}`;
  if (ref.name) return `name:${ref.name.toLowerCase()}`;
  return null;
}

export async function resolvePerson(ref: PersonRef, fub: FubAdapter, store: AppStore): Promise<FubPerson | null> {
  if (ref.personId) {
    const found = await fub.getPersonById(ref.personId);
    if (found) return found;
  }

  const key = keyOf(ref);
  if (key) {
    const cached = store.getCachedPerson(key);
    if (cached) {
      const person = await fub.getPersonById(cached);
      if (person) return person;
    }
  }

  const lookup: { email?: string; phone?: string; name?: string } = {};
  if (ref.email) lookup.email = ref.email;
  if (ref.phone) lookup.phone = ref.phone;
  if (ref.name) lookup.name = ref.name;

  const person = await fub.findPersonByExternalRef(lookup);
  if (person && key) store.setCachedPerson(key, person.id);
  return person;
}

export async function resolveOrUpsertPerson(ref: PersonRef, fub: FubAdapter, store: AppStore): Promise<FubPerson> {
  const existing = await resolvePerson(ref, fub, store);
  if (existing) return existing;

  const createInput: { name?: string; email?: string; phone?: string } = {};
  if (ref.name) createInput.name = ref.name;
  if (ref.email) createInput.email = ref.email;
  if (ref.phone) createInput.phone = ref.phone;

  const created = await fub.upsertPerson(createInput);

  const key = keyOf(ref);
  if (key) store.setCachedPerson(key, created.id);
  return created;
}
