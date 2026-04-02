import { auth } from "./firebase";
import {
  EmailAuthProvider,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  ConfirmationResult,
  User,
  linkWithCredential,
} from "firebase/auth";

let confirmationResult: ConfirmationResult | null = null;

const toPhoneLoginEmail = (e164Phone: string) => {
  const normalized = e164Phone.replace(/\D/g, "");
  return `m${normalized}@mobile.ssmp.local`;
};

export const setupRecaptcha = () => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "invisible",
      }
    );
  }
};

export const sendOTP = async (phone: string): Promise<void> => {
  setupRecaptcha();

  const appVerifier = window.recaptchaVerifier;

  confirmationResult = await signInWithPhoneNumber(
    auth,
    phone,
    appVerifier
  );
};

export const verifyOTP = async (otp: string): Promise<User> => {
  if (!confirmationResult) {
    throw new Error("OTP not sent yet");
  }

  const result = await confirmationResult.confirm(otp);
  return result.user;
};

export const attachPhonePassword = async (e164Phone: string, password: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No verified mobile user in session. Verify OTP first.");
  }

  const loginEmail = toPhoneLoginEmail(e164Phone);
  const credential = EmailAuthProvider.credential(loginEmail, password);

  try {
    await linkWithCredential(currentUser, credential);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to attach mobile password";
    if (!/already linked|credential-already-in-use/i.test(message)) {
      throw error;
    }
  }
};

export const signInWithPhonePassword = async (e164Phone: string, password: string): Promise<User> => {
  const loginEmail = toPhoneLoginEmail(e164Phone);
  const { user } = await signInWithEmailAndPassword(auth, loginEmail, password);
  return user;
};

export const resetOtpFlow = (): void => {
  confirmationResult = null;
};

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}