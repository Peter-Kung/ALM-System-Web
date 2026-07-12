import { redirect } from "next/navigation";

export default async function SetupPage() {
  redirect("/login");
}
