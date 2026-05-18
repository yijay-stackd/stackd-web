import { use } from "react";
import { ProfileDetail } from "@/features/profile/profile-detail";

type Params = { slug: string };

export default function ProfilePage({ params }: { params: Promise<Params> }) {
  const { slug } = use(params);
  return <ProfileDetail slug={slug} />;
}
