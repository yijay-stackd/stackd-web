import type { Http } from "../http/fetcher";

// Mirrors backend dto/create-contact.dto.ts CONTACT_KIND_VALUES.
export type ContactKindValue =
  | "linkedin"
  | "email"
  | "portfolio"
  | "instagram"
  | "whatsapp"
  | "wechat"
  | "telegram"
  | "github"
  | "twitter"
  | "website"
  | "other";

export type ContactResponse = {
  id: string;
  kind: ContactKindValue;
  value: string;
  label: string | null;
  sort_order: number;
};

export type CreateContactInput = {
  kind: ContactKindValue;
  value: string;
  label?: string;
  sort_order?: number;
};

export type UpdateContactInput = {
  kind?: ContactKindValue;
  value?: string;
  label?: string;
  sort_order?: number;
};

// Maps the frontend's legacy `contactType` (linkedin/email/portfolio) to
// backend's wider kind enum — the frontend subset is a strict prefix of the
// backend set, so no translation needed.
export const profileContactsApi = {
  create(
    http: Http,
    profileId: string,
    body: CreateContactInput
  ): Promise<ContactResponse> {
    return http.post<ContactResponse>(
      `/profiles/${profileId}/contacts`,
      body,
      { skipRetry: true }
    );
  },

  update(
    http: Http,
    profileId: string,
    contactId: string,
    body: UpdateContactInput
  ): Promise<ContactResponse> {
    return http.patch<ContactResponse>(
      `/profiles/${profileId}/contacts/${contactId}`,
      body,
      { skipRetry: true }
    );
  },

  remove(
    http: Http,
    profileId: string,
    contactId: string
  ): Promise<{ deleted: true; id: string }> {
    return http.delete<{ deleted: true; id: string }>(
      `/profiles/${profileId}/contacts/${contactId}`,
      { skipRetry: true }
    );
  },
};
