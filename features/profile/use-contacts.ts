"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import {
  profileContactsApi,
  type ContactResponse,
  type CreateContactInput,
  type UpdateContactInput,
} from "@/lib/api/profile-contacts";
import {
  profilesKeys,
  type ProfileResponse,
} from "@/lib/api/profiles";

// Contact writes don't return the full profile. Patch the contacts array on
// the cached profile so the public/owner views reflect the change instantly.
function patchProfileContacts(
  qc: ReturnType<typeof useQueryClient>,
  apply: (current: ContactResponse[]) => ContactResponse[]
) {
  const mine = qc.getQueryData<ProfileResponse | null>(profilesKeys.mine());
  if (!mine) return;
  const next: ProfileResponse = {
    ...mine,
    contacts: apply(mine.contacts ?? []),
  };
  qc.setQueryData(profilesKeys.mine(), next);
  qc.setQueryData(profilesKeys.bySlug(mine.slug), next);
}

export function useCreateContact(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContactInput) => {
      if (!profileId) throw new Error("useCreateContact: profileId required");
      return profileContactsApi.create(getHttpClient(), profileId, body);
    },
    onSuccess: (contact) => {
      patchProfileContacts(qc, (current) => [...current, contact]);
    },
  });
}

export function useUpdateContact(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { contactId: string; body: UpdateContactInput }) => {
      if (!profileId) throw new Error("useUpdateContact: profileId required");
      return profileContactsApi.update(
        getHttpClient(),
        profileId,
        args.contactId,
        args.body
      );
    },
    onSuccess: (contact) => {
      patchProfileContacts(qc, (current) =>
        current.map((c) => (c.id === contact.id ? contact : c))
      );
    },
  });
}

export function useDeleteContact(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => {
      if (!profileId) throw new Error("useDeleteContact: profileId required");
      return profileContactsApi.remove(getHttpClient(), profileId, contactId);
    },
    onSuccess: (_res, contactId) => {
      patchProfileContacts(qc, (current) =>
        current.filter((c) => c.id !== contactId)
      );
    },
  });
}
