import { redirect } from "next/navigation";
import { publicOrigin } from "@boutik/domain";

export default function WebIndexPage() {
  redirect(publicOrigin());
}
