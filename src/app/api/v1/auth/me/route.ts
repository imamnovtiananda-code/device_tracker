import { authed, ok, toProblem } from "@/lib/api";

export async function GET() {
  try {
    const user = await authed();
    return ok({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, employeeNo: user.employeeNo, preferredLocale: user.preferredLocale });
  } catch (e) { return toProblem(e); }
}
