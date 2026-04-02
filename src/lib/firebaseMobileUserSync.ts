import { supabase } from "@/integrations/supabase/client";

export type AppRole = "seeker" | "provider" | "admin";

interface SyncFirebaseMobileUserInput {
  firebaseUid: string;
  phone: string;
  role: AppRole;
  name?: string;
}

interface MobileUserRow {
  firebase_uid: string;
  phone: string;
  role: AppRole;
  name: string | null;
  is_blocked: boolean;
}

export const getMobileUserByFirebaseUid = async (firebaseUid: string): Promise<MobileUserRow | null> => {
  const { data, error } = await supabase
    .from("mobile_users")
    .select("firebase_uid, phone, role, name, is_blocked")
    .eq("firebase_uid", firebaseUid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const syncFirebaseMobileUser = async ({
  firebaseUid,
  phone,
  role,
  name,
}: SyncFirebaseMobileUserInput): Promise<MobileUserRow> => {
  const payload = {
    firebase_uid: firebaseUid,
    phone,
    role,
    name: name?.trim() || null,
    last_login_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("mobile_users")
    .upsert(payload, { onConflict: "firebase_uid" })
    .select("firebase_uid, phone, role, name, is_blocked")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const getMobileUserByPhone = async (phone: string): Promise<MobileUserRow | null> => {
  const { data, error } = await supabase
    .from("mobile_users")
    .select("firebase_uid, phone, role, name, is_blocked")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
