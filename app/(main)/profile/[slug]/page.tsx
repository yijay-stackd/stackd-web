import { use } from "react";
import { ProfileDetail } from "@/components/profile/profile-detail";

type Params = { slug: string };

export default function ProfilePage({ params }: { params: Promise<Params> }) {
  const { slug } = use(params);
  return <ProfileDetail slug={slug} />;
}
