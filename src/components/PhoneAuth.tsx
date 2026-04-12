import { useState } from "react";
import { sendOTP, verifyOTP } from "../otp";
import { useNavigate } from "react-router-dom";
import { AppRole, getMobileUserByFirebaseUid, syncFirebaseMobileUser } from "@/lib/firebaseMobileUserSync";

type MobileAuthMode = "login" | "register";

export default function PhoneAuth() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Exclude<AppRole, "admin">>("seeker");
  const [authMode, setAuthMode] = useState<MobileAuthMode>("login");
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSendOTP = async () => {
    setError(null);

    if (authMode === "register" && !name.trim()) {
      setError("Name is required for mobile registration");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setError("Enter valid 10-digit number");
      return;
    }

    try {
      setLoading(true);

      const fullPhone = "+91" + phone;
      await sendOTP(fullPhone);

      setIsOTPSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError(null);

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);

      const user = await verifyOTP(otp);
      const fullPhone = "+91" + phone;

      const existing = await getMobileUserByFirebaseUid(user.uid);
      const effectiveRole: AppRole = existing?.role ?? role;

      await syncFirebaseMobileUser({
        firebaseUid: user.uid,
        phone: fullPhone,
        role: effectiveRole,
        name: authMode === "register" ? name : existing?.name ?? undefined,
      });

      if (effectiveRole === "admin") {
        navigate("/dashboard/admin");
      } else if (effectiveRole === "provider") {
        navigate("/dashboard/provider");
      } else {
        navigate("/dashboard/seeker");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Phone Login</h2>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <button type="button" onClick={() => setAuthMode("login")} disabled={loading}>
          Login
        </button>
        <button type="button" onClick={() => setAuthMode("register")} disabled={loading}>
          Register
        </button>
      </div>

      {authMode === "register" && !isOTPSent && (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter full name"
          />
          <div style={{ display: "flex", gap: "8px", margin: "8px 0" }}>
            <button type="button" onClick={() => setRole("seeker")} disabled={loading}>
              Seeker
            </button>
            <button type="button" onClick={() => setRole("provider")} disabled={loading}>
              Provider
            </button>
          </div>
        </>
      )}

      {!isOTPSent && (
        <>
          <div>
            <span>+91</span>
            <input
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="Enter mobile number"
              maxLength={10}
            />
          </div>

          <button onClick={handleSendOTP} disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </>
      )}

      {isOTPSent && (
        <>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter OTP"
            maxLength={6}
          />

          <button onClick={handleVerifyOTP} disabled={loading}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* MUST for Firebase */}
      <div id="recaptcha-container"></div>
    </div>
  );
}