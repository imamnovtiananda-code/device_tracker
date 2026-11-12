"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import * as s from "./db/schema";
import { eq } from "drizzle-orm";
import {
  archiveAsset, cancelBorrowing, checkoutBorrowing, createAsset, createBorrowing,
  createReturn, decideApproval, ensureSeed, markNotificationRead, requestExtension,
  submitBorrowing, updateAsset,
} from "./services";
import { clearSessionCookie, getCurrentUser, requireUser, sessionCookie } from "./auth";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Terjadi kesalahan";
}

export async function loginAction(formData: FormData) {
  ensureSeed();
  const userId = String(formData.get("userId") ?? "");
  const db = getDb();
  const user = db.select().from(s.users).where(eq(s.users.id, userId)).get();
  if (!user) throw new Error("Pengguna tidak ditemukan");
  const jar = await cookies();
  const c = sessionCookie(user.id);
  jar.set(c.name, c.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: c.maxAge });
  redirect("/");
}

export async function logoutAction() {
  const jar = await cookies();
  const c = clearSessionCookie();
  jar.set(c.name, c.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  redirect("/login");
}

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "id-ID");
  const jar = await cookies();
  jar.set("dt_locale", locale === "en-US" ? "en-US" : "id-ID", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

export async function createAssetAction(formData: FormData) {
  const user = await requireUser();
  try {
    const id = createAsset(user, {
      assetCode: String(formData.get("assetCode")),
      name: String(formData.get("name")),
      categoryId: String(formData.get("categoryId") || "") || undefined,
      assetType: String(formData.get("assetType") || "serialized"),
      serialNumber: String(formData.get("serialNumber") || "") || undefined,
      brand: String(formData.get("brand") || "") || undefined,
      model: String(formData.get("model") || "") || undefined,
      description: String(formData.get("description") || "") || undefined,
      locationId: String(formData.get("locationId") || "") || undefined,
      quantityTotal: Number(formData.get("quantityTotal") || 1),
    });
    revalidatePath("/assets");
    redirect(`/assets/${id}`);
  } catch (e) {
    throw e;
  }
}

export async function updateAssetAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  try {
    updateAsset(user, id, {
      name: String(formData.get("name") || "") || undefined,
      condition: String(formData.get("condition") || "") || undefined,
      status: String(formData.get("status") || "") || undefined,
      locationId: String(formData.get("locationId") || "") || undefined,
      description: String(formData.get("description") || "") || undefined,
    });
    revalidatePath(`/assets/${id}`);
    revalidatePath("/assets");
  } catch (e) {
    throw e;
  }
}

export async function archiveAssetAction(formData: FormData) {
  const user = await requireUser();
  try {
    archiveAsset(user, String(formData.get("id")));
    revalidatePath("/assets");
    redirect("/assets");
  } catch (e) {
    throw e;
  }
}

export async function createBorrowingAction(formData: FormData) {
  const user = await requireUser();
  try {
    const assetIds = formData.getAll("assetIds").map(String).filter(Boolean);
    const quantities = formData.getAll("quantities").map((v) => Number(v) || 1);
    const items = assetIds.map((assetId, i) => ({ assetId, quantity: quantities[i] ?? 1 }));
    const id = createBorrowing(user, {
      purpose: String(formData.get("purpose")),
      startAt: new Date(String(formData.get("startAt"))).toISOString(),
      dueAt: new Date(String(formData.get("dueAt"))).toISOString(),
      items,
    });
    revalidatePath("/borrowings");
    redirect(`/borrowings/${id}`);
  } catch (e) {
    throw e;
  }
}

export async function submitBorrowingAction(formData: FormData) {
  const user = await requireUser();
  try {
    submitBorrowing(user, String(formData.get("id")));
    revalidatePath("/borrowings");
  } catch (e) {
    throw e;
  }
}

export async function cancelBorrowingAction(formData: FormData) {
  const user = await requireUser();
  try {
    cancelBorrowing(user, String(formData.get("id")));
    revalidatePath("/borrowings");
  } catch (e) {
    throw e;
  }
}

export async function checkoutAction(formData: FormData) {
  const user = await requireUser();
  try {
    checkoutBorrowing(user, String(formData.get("id")));
    revalidatePath("/borrowings");
  } catch (e) {
    throw e;
  }
}

export async function decideApprovalAction(formData: FormData) {
  const user = await requireUser();
  try {
    decideApproval(user, String(formData.get("taskId")), String(formData.get("action")) === "reject" ? "reject" : "approve", String(formData.get("comments") || ""));
    revalidatePath("/approvals");
    revalidatePath("/borrowings");
  } catch (e) {
    throw e;
  }
}

export async function createReturnAction(formData: FormData) {
  const user = await requireUser();
  try {
    const borrowingId = String(formData.get("borrowingId"));
    const itemIds = formData.getAll("borrowingItemId").map(String);
    const quantities = formData.getAll("quantity").map((v) => Number(v) || 0);
    const conditions = formData.getAll("conditionIn").map(String);
    const items = itemIds.map((borrowingItemId, i) => ({
      borrowingItemId, quantity: quantities[i] ?? 0, conditionIn: conditions[i] ?? "good",
    })).filter((i) => i.quantity > 0);
    if (!items.length) throw new Error("Pilih minimal satu item dengan jumlah > 0");
    createReturn(user, borrowingId, items);
    revalidatePath("/borrowings");
    revalidatePath("/returns");
  } catch (e) {
    throw e;
  }
}

export async function requestExtensionAction(formData: FormData) {
  const user = await requireUser();
  try {
    requestExtension(user, String(formData.get("borrowingId")), new Date(String(formData.get("newDueAt"))).toISOString(), String(formData.get("reason") || ""));
    revalidatePath("/borrowings");
  } catch (e) {
    throw e;
  }
}

export async function markReadAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  markNotificationRead(user, String(formData.get("id")));
  revalidatePath("/notifications");
}
