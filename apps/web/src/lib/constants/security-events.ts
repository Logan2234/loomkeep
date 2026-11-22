import { m } from "#lib/paraglide/messages.js";
import type { SecurityEventType } from "@loomkeep/shared";

/** What each security event is called, for the admin security log and account page. */
export function securityEventLabels(): Record<SecurityEventType, string> {
  return {
    USER_REGISTERED: m.admin_security_registration(),
    USER_DELETED: m.admin_security_account_deletion(),
    EMAIL_CHANGED: m.admin_security_email_change(),
    PASSWORD_CHANGED: m.admin_security_password_change(),
    PASSWORD_RESET: m.admin_security_password_reset(),
    LOGIN_FAILED: m.admin_security_login_failed(),
    NEW_DEVICE_LOGIN: m.admin_security_new_device(),
    MFA_TOTP_ENABLED: m.admin_security_mfa_totp_enabled(),
    MFA_TOTP_DISABLED: m.admin_security_mfa_totp_disabled(),
    MFA_EMAIL_ENABLED: m.admin_security_mfa_email_enabled(),
    MFA_EMAIL_DISABLED: m.admin_security_mfa_email_disabled(),
    MFA_WEBAUTHN_ADDED: m.admin_security_mfa_webauthn_added(),
    MFA_WEBAUTHN_REMOVED: m.admin_security_mfa_webauthn_removed(),
    MFA_WEBAUTHN_RENAMED: m.admin_security_mfa_webauthn_renamed(),
    MFA_PASSWORDLESS_ENABLED: m.admin_security_mfa_passwordless_enabled(),
    MFA_PASSWORDLESS_DISABLED: m.admin_security_mfa_passwordless_disabled(),
    MFA_RECOVERY_CODES_REGENERATED:
      m.admin_security_mfa_recovery_codes_regenerated(),
    MFA_RECOVERY_CODE_USED: m.admin_security_mfa_recovery_code_used(),
    MFA_CHALLENGE_LOCKED: m.admin_security_mfa_challenge_locked(),
    REAUTH_LOCKED: m.admin_security_reauth_locked(),
    API_KEY_CREATED: m.admin_security_api_key_created(),
    API_KEY_REVOKED: m.admin_security_api_key_revoked(),
    API_KEY_LEAKED: m.admin_security_api_key_leaked(),
  };
}
